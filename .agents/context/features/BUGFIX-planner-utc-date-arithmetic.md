# Bugfix — Planner Date Arithmetic Uses Local Timezone Instead of UTC

## Context

This is a prerequisite fix, separate from and ordered **before** Phase 5
(`05-plan-generation-and-dashboard.md`). Phase 5's date-handling design
decision anchors all calendar-only dates (`MealPlan.startDate/endDate`,
`MealPlanEntry.date`) at UTC midnight and formats them with UTC getters,
specifically so the displayed/stored day never shifts depending on the
server's local timezone. That decision only holds if `lib/planner/generate.ts`
— which receives that UTC-anchored `Date` and does all of its own day
arithmetic on it — is itself timezone-safe. It currently is not.

Per `ai-workflow-rules.md` ("If a requirement is ambiguous, resolve it in
the relevant context file before implementing" / "Do not combine unrelated
system boundaries in a single implementation step"), this is its own
verifiable unit. Do not start any Phase 5 sub-phase (5A/5B/5C) until this
is fixed and `npx vitest run` passes.

## Root Cause

`lib/planner/generate.ts` has three helper functions that use **local-timezone**
`Date` methods on values that are meant to represent calendar days, not
moments in time:

```typescript
function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)        // ← local hours
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)  // ← local date
  return d
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()      // ← local day-of-week
  return day === 0 || day === 6
}
```

When a caller passes a UTC-midnight `Date` (e.g. `2026-07-01T00:00:00.000Z`)
and the Node process is running in a timezone behind UTC (e.g.
`America/New_York`, UTC−5), that instant is `2026-06-30T19:00` in local
time. `setHours`/`getDate`/`getDay` all operate on the **local** calendar
day, which is still June 30 at that instant — so `startOfDay`, `addDays`,
and `isWeekend` silently compute against the wrong day. This can:

- Shift `MealPlanEntry.date` values by one day across the whole plan
- Place the Special Day on the wrong day of the week (off by one from the
  intended Saturday/Sunday)
- Make `lib/planner/generate.test.ts`'s existing date-based assertions
  pass or fail depending on the timezone of the machine running them,
  rather than being deterministic

This is silent — there is no error, no warning, just a wrong but
plausible-looking date.

## Scope

| File | Expected work |
|---|---|
| `lib/planner/generate.ts` | **Confirmed fix required** — patch `startOfDay`, `addDays`, `isWeekend` (Step 1) |
| `lib/planner/rules.ts` | Audit only (Step 2) — `hasFlavorCollision`/`wouldRepeat`/`pickNonRepeatDish` operate on dish IDs and flavor strings, not dates, so this is expected to be a quick "confirmed clean" pass, not a fix |
| `lib/planner/gate.ts` | Audit only (Step 2) — operates on dish counts, not dates; same expectation |
| `lib/planner/fixtures.ts` | Audit only (Step 2) — dish fixtures are not expected to contain `Date` values at all (the caller supplies `startDate`); confirm this is still true |
| `lib/planner/generate.test.ts` | **Audit + fix required** (Step 3) — any assertion using local-time `Date` getters (`.getDate()`, `.getDay()`, `.getHours()`) on entry/output dates needs to switch to the UTC equivalents; add new timezone-invariance regression tests |

Do not touch `lib/planner/types.ts` — no type shapes change.

---

## Step 1: Patch `lib/planner/generate.ts`

Replace the three functions with UTC-safe equivalents. This is a drop-in
replacement — no other logic in the file changes, and no caller-facing
signature changes.

```typescript
function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}
```

Nothing else in `generate.ts` needs to change — `buildWindowInfos`,
`shuffle`, the flavor/repeat relaxation logic, and the warnings logic are
all unaffected; they don't call local-time `Date` methods.

## Step 2: Audit the rest of `lib/planner/` for the same pattern

Grep the directory for local-time `Date` methods that aren't already
intentional:

```bash
grep -rn "\.getDate()\|\.getDay()\|\.getHours()\|\.getMinutes()\|\.setDate(\|\.setHours(\|\.setMinutes(" lib/planner/
```

Expected result: only the three occurrences just fixed in `generate.ts`
(now removed) and nothing in `rules.ts`, `gate.ts`, or `fixtures.ts`. If
the grep turns up anything else, treat it the same way as Step 1 — convert
to the `setUTC*`/`getUTC*` equivalent — and add it to the Files Changed
table below before finishing this task.

## Step 3: Audit and extend `lib/planner/generate.test.ts`

### 3a — Audit existing assertions

Read through every test that asserts on `PlannerEntry.date` or derives a
day-of-week/weekend check from an output date. Any use of `.getDate()`,
`.getDay()`, or constructing comparison dates via `new Date(y, m, d)`
(which is itself local-time) on planner *output* needs to switch to the
UTC equivalent (`.getUTCDate()`, `.getUTCDay()`, or
`Date.UTC(y, m, d)`/an ISO string literal) so the test's own assertion
logic doesn't reintroduce the same bug it's supposed to catch.

This applies only to assertions on `PlannerEntry.date` and similar output
values — not to incidental `Date` usage elsewhere in the test file that
isn't representing a calendar day (if any).

### 3b — Add explicit timezone-invariance regression tests

Add a new `describe("timezone safety")` block. The strongest test for "this
function's output doesn't depend on the machine's local timezone" is to
run the **same** generation twice under two different `TZ` values and
assert byte-identical output:

```typescript
describe("timezone safety", () => {
  const originalTZ = process.env.TZ

  afterEach(() => {
    process.env.TZ = originalTZ
  })

  it("produces identical entry dates under UTC and a negative-offset timezone", () => {
    const input = {
      dishes: normalLibrary,
      startDate: new Date("2026-01-01T00:00:00.000Z"), // Thursday
      durationDays: 14,
      random: () => 0.5,
    }

    process.env.TZ = "UTC"
    const outputUTC = generatePlan(input)

    process.env.TZ = "America/New_York" // UTC-5/-4 — the case that previously broke
    const outputNY = generatePlan(input)

    expect(outputNY.entries.map((e) => e.date.toISOString())).toEqual(
      outputUTC.entries.map((e) => e.date.toISOString())
    )
    expect(outputNY.warnings).toEqual(outputUTC.warnings)
  })

  it("places the special day on a UTC Saturday or Sunday even under a negative-offset timezone", () => {
    process.env.TZ = "America/New_York"

    const output = generatePlan({
      dishes: normalLibrary,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      durationDays: 14,
      random: () => 0, // deterministic: always picks the first available weekend offset
    })

    const specialEntry = output.entries.find(
      (e) => e.mealTime === "Lunch" && e.isSpecialDay
    )

    expect(specialEntry).toBeDefined()
    const weekday = specialEntry!.date.getUTCDay()
    expect([0, 6]).toContain(weekday) // 0 = Sunday, 6 = Saturday, in UTC
  })
})
```

Notes for the agent:

- `normalLibrary` should already be importable from `lib/planner/fixtures.ts`
  — reuse it, don't redefine a new fixture for this.
- Setting `process.env.TZ` and then constructing/reading `Date` values
  afterward is sufficient in Node to change local-time method behavior for
  the rest of that test — no extra mocking library is needed. Always
  restore the original value in `afterEach` so this doesn't leak into
  other test files in the same run.
- If the first new test (`outputNY` vs `outputUTC` equality) fails before
  Step 1's patch is applied and passes after, that's the expected
  before/after signal confirming the fix actually works — worth running
  once pre-patch to confirm it genuinely catches the bug, not just
  vacuously passing.

## Step 4: Record the fix

Add an entry to `progress-tracker.md`'s **Bug Fixes** section, matching the
existing entry style (see "Dish Library — pagination", "IngredientCombobox"
entries):

```markdown
- **Planner — local-timezone date arithmetic** (2026-0X-XX)
  - **Root cause**: `startOfDay`, `addDays`, `isWeekend` in
    `lib/planner/generate.ts` used local-time `Date` methods
    (`setHours`, `setDate`/`getDate`, `getDay`) instead of their UTC
    equivalents. A UTC-midnight `startDate` (as Phase 5 always passes)
    could compute the wrong calendar day, the wrong day-of-week, and
    therefore the wrong Special Day placement, when the server process
    ran in a timezone behind UTC.
  - **Fix**: switched all three functions to `setUTCHours`,
    `setUTCDate`/`getUTCDate`, `getUTCDay`. No signature or caller-facing
    behavior change. Added a `describe("timezone safety")` block to
    `generate.test.ts` asserting identical output under `TZ=UTC` and
    `TZ=America/New_York`, plus a UTC-weekend assertion for Special Day
    placement.
  - **File changed**: `lib/planner/generate.ts`, `lib/planner/generate.test.ts`
```

Do **not** edit `04-planner-core.md`'s Design Decisions table — that
document records decisions as of Phase 4's completion; this is a
post-completion correctness fix, which belongs in `progress-tracker.md`'s
running Bug Fixes log, consistent with how the pagination and
ingredient-combobox fixes were recorded there rather than by rewriting
`03-dish-library.md`'s original decisions.

---

## Files Changed

| File | Action |
|---|---|
| `lib/planner/generate.ts` | Modify — `startOfDay`, `addDays`, `isWeekend` switched to UTC methods |
| `lib/planner/generate.test.ts` | Modify — audit existing date assertions for local-time usage; add `describe("timezone safety")` block |
| `lib/planner/rules.ts` | Audit only — expected no change |
| `lib/planner/gate.ts` | Audit only — expected no change |
| `lib/planner/fixtures.ts` | Audit only — expected no change |
| `progress-tracker.md` | Update — add Bug Fixes entry |

---

## Verification Checklist

1. `grep -rn "\.getDate()\|\.getDay()\|\.getHours()\|\.setDate(\|\.setHours(" lib/planner/` — zero matches outside of explicitly reviewed/justified cases
2. `npx vitest run` — full suite passes, including the new `describe("timezone safety")` block
3. Run `TZ=America/New_York npx vitest run` and `TZ=UTC npx vitest run` (or `TZ=Pacific/Kiritimati npx vitest run` for a positive-offset check) — both pass identically; no test result depends on the shell's `TZ`
4. `pnpm run typecheck` — passes (no signature changes expected, but confirm)
5. `pnpm run build` — passes
6. `lib/planner/generate.ts` still has zero imports from `next`, `next-auth`, or `@prisma/client` (Invariant 1, unaffected by this fix, confirm anyway)
7. `progress-tracker.md` updated with the Bug Fixes entry from Step 4