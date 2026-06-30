# Phase 4 — Planner Core (Pure Logic, No UI)

## Goal

Implement the meal plan generation algorithm and rule-checking functions as pure, framework-free TypeScript in `lib/planner/`, with full Vitest unit tests. Zero imports from `next`, `next-auth`, or `@prisma/client`.

## Deliverable

Tested generation algorithm that enforces all balance rules, fully testable in isolation with in-memory fixtures.

> **Revision note:** this replaces the earlier draft of this plan. Five
> issues were resolved before continuing — the dead `INSUFFICIENT_LUNCH_VARIETY`
> warning code, Special Day placement for non-multiple-of-14 durations, the
> 2-vs-3 lunch dish trigger, seedable randomness in the type contract, and the
> gate-failure error shape — see **Design Decisions** below. These were
> resolved here, in the context file, per `ai-workflow-rules.md` ("if a
> requirement is ambiguous, resolve it in the relevant context file before
> implementing"), rather than improvised mid-implementation.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| `INSUFFICIENT_LUNCH_VARIETY` warning code | **Dropped.** Only `REPEAT_FORCED` (not enough non-repeating lunch dishes) and `FLAVOR_COLLISION_RELAXED` (no flavor-clean pairing available) exist for lunch. | The original type list defined `INSUFFICIENT_LUNCH_VARIETY` but Step 5's algorithm and the test list never assigned it a distinct scenario — it was dead code waiting to cause confusion about which code fires when. `REPEAT_FORCED` already covers "not enough variety to avoid a repeat." |
| Special Day placement for non-multiple-of-14 durations | Chunk the plan into sequential 14-day windows (the last window may be shorter than 14 days). **Each window gets exactly one Special Day if a Saturday or Sunday falls within it**; if a short trailing window contains no weekend day, that window gets none and a `NO_SPECIAL_DISH`-style "skipped" note is not needed (it's a calendar gap, not a relaxation) — see Step 5 below for the distinction from the *no-special-dish-in-library* warning. | Confirmed against `project-overview.md` ("exactly one Special Day per 2-week cycle") and the existing test `it("handles 28-day duration (two 2-week cycles)")`, which only makes sense if a 28-day plan yields exactly 2 Special Days — one per window. This generalizes that rule to any duration instead of leaving it undefined off the 14/28 multiples. |
| Lunch dish count (2 vs 3) | Default to 2. Use 3 **only probabilistically** — when ≥3 candidate dishes are available that are simultaneously non-repeating and mutually flavor-clean, the generator calls the injected `random()` and uses 3 dishes with a fixed 20% probability (`LUNCH_THREE_DISH_PROBABILITY = 0.2`, exported as a named constant so it isn't a magic number). If fewer than 3 valid candidates exist, it's always 2 (or fewer, if even 2 can't be filled without relaxation). | Pure "always 2" forecloses the spec's stated 2–3 range for no real reason; pure "random whenever the pool supports it" (the original instruction) is unverifiable without a seed. Gating it behind an injectable `random()` makes both the 2-dish and 3-dish code paths independently testable via a fixed seed, while still being genuinely randomized in production. |
| Seedable randomness in `GenerationInput` | Add `random?: () => number` (defaults to `Math.random`) to `GenerationInput`. All shuffling and probabilistic decisions (weekend pick within a window, 2-vs-3 lunch sizing) go through this single injected function — never a bare call to `Math.random()` inside `generate.ts`. | Several planned tests ("does not repeat," "enforces flavor uniqueness," "assigns 2 lunch dishes per non-special day") need deterministic, reproducible output. Without this hook those tests are flaky by construction. This was already flagged as an open question in the original draft; it's now a resolved part of the type contract, not left to implementation-time discretion. |
| Gate failure shape | `checkPreFlightGate` stays pure (returns `GateResult`, never throws). `generatePlan` throws a dedicated `PreFlightGateError extends Error` carrying `.errors: string[]` (the same array `GateResult.errors` produced) when the gate is blocked. | Phase 5's Server Action needs a concrete shape to catch and map into `{ success: false, error }` per `code-standards.md`. Leaving this as a bare `throw` with an unspecified shape would push an ambiguous decision onto Phase 5 instead of resolving it here, where the contract actually lives. |

---

## Step 1: Test Infrastructure — Vitest

**Action:** Install Vitest and create config.

- `pnpm add -D vitest`
- Add `"test": "vitest run"` script to `package.json`
- Create `vitest.config.ts` at project root (minimal — TypeScript + path alias `@/`)

**Files:**
- `package.json` (modify — add devDep + script)
- `vitest.config.ts` (create)

---

## Step 2: Planner Types (`lib/planner/types.ts`)

**Action:** Define the plain TypeScript contract between the generation algorithm and everything that calls it.

### Input Types

```typescript
/** A dish as seen by the planner — no Prisma relations, just data. */
interface PlannerDish {
  id: string
  name: string
  mealTime: "Breakfast" | "Lunch"
  isSpecial: boolean
  flavors: string[]         // flavor names, e.g. ["spicy", "umami"]
  ingredientNames: string[] // ingredient names for shopping list snapshot
}

/** Everything the algorithm needs to generate a plan. */
interface GenerationInput {
  dishes: PlannerDish[]
  startDate: Date         // first day of the plan
  durationDays: number    // e.g. 14 for 2 weeks
  /**
   * Injectable RNG, defaults to Math.random. Every shuffle and every
   * probabilistic decision (weekend pick within a 14-day window, 2-vs-3
   * lunch sizing) must go through this function — never a bare
   * Math.random() call inside generate.ts — so output is reproducible
   * under a fixed seed in tests.
   */
  random?: () => number
}
```

### Output Types

```typescript
type WarningCode =
  | "INSUFFICIENT_BREAKFAST_VARIETY"
  | "FLAVOR_COLLISION_RELAXED"
  | "NO_SPECIAL_DISH"
  | "REPEAT_FORCED"
  // NOTE: INSUFFICIENT_LUNCH_VARIETY intentionally removed — REPEAT_FORCED
  // already covers "not enough lunch dishes to avoid a repeat." See Design
  // Decisions above.

interface PlannerWarning {
  code: WarningCode
  message: string          // human-readable, shown in UI
}

interface PlannerEntryDish {
  dishId: string
  dishName: string
  sortOrder: number        // 0 for breakfast, 0-2 for lunch
}

interface PlannerEntry {
  date: Date
  mealTime: "Breakfast" | "Lunch"
  dishes: PlannerEntryDish[]
  isSpecialDay: boolean
}

interface ShoppingItem {
  ingredientName: string   // deduplicated
  dishName: string         // snapshot: which dish contributed this
}

interface GenerationOutput {
  entries: PlannerEntry[]
  warnings: PlannerWarning[]
  shoppingItems: ShoppingItem[]
}
```

**Files:**
- `lib/planner/types.ts` (create)

---

## Step 3: Pre-flight Gate (`lib/planner/gate.ts`)

**Action:** Check whether the dish library meets minimum requirements before generation runs.

```typescript
interface GateResult {
  blocked: boolean
  errors: string[]  // e.g. ["Not enough Breakfast dishes (need at least 1, have 0)"]
}

function checkPreFlightGate(dishes: PlannerDish[]): GateResult
```

**Rules (hard gate):**
- Blocked if < 1 Breakfast dish
- Blocked if < 2 Lunch dishes
- Error messages must name the count: `"Not enough Breakfast dishes (need at least 1, have 0)"`

`checkPreFlightGate` itself never throws — it's a pure predicate, callable
on its own (e.g. by the Dashboard banner in Phase 7) without triggering
generation. The throwing behavior lives one layer up, in `generate.ts`
(Step 5) via `PreFlightGateError`.

**Files:**
- `lib/planner/gate.ts` (create)

---

## Step 4: Rule-checking Functions (`lib/planner/rules.ts`)

**Action:** Reusable validation functions used by both generation (Step 5) and manual edit (Phase 6).

```typescript
/** Are all flavors distinct across dishes in a single lunch slot? */
function hasFlavorCollision(dishes: PlannerDish[]): boolean

/** Has this dish already been assigned in this plan period? */
function wouldRepeat(assignedIds: Set<string>, candidateId: string): boolean

/** Given a set of assigned dish IDs and available dishes, pick the next dish
 *  that avoids repeat. Returns null if no non-repeat option exists. */
function pickNonRepeatDish(
  assignedIds: Set<string>,
  candidates: PlannerDish[]
): PlannerDish | null
```

**Files:**
- `lib/planner/rules.ts` (create)

---

## Step 5: Generation Algorithm (`lib/planner/generate.ts`)

**Action:** Main entry point that produces a complete meal plan.

```typescript
class PreFlightGateError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "))
    this.name = "PreFlightGateError"
  }
}

const LUNCH_THREE_DISH_PROBABILITY = 0.2

function generatePlan(input: GenerationInput): GenerationOutput
```

### Algorithm

1. **Pre-flight gate** — call `checkPreFlightGate()`. If blocked, throw
   `new PreFlightGateError(gateResult.errors)`. The caller (Phase 5's Server
   Action) catches this specific error type and maps it into
   `{ success: false, error: ... }`.

2. **Partition dishes** — split into `breakfastDishes` and `lunchDishes` arrays.

3. **Window chunking + Special Day placement** — split the plan's date range
   into sequential 14-day windows (the final window may be shorter than 14
   days if `durationDays` isn't a multiple of 14). For each window:
   - Find every Saturday/Sunday inside that window.
   - If none exist (only possible in a short trailing window), the window
     gets no Special Day — this is a calendar fact, not a relaxation, so no
     warning is emitted for it.
   - If at least one weekend day exists, pick one at random via the
     injected `random()` (default `Math.random`).
   - If no `isSpecial` dish exists in `lunchDishes` at all, emit a single
     `NO_SPECIAL_DISH` warning **once for the whole plan** (not once per
     window) and skip special-day assignment everywhere.
   - Otherwise mark the chosen day in each window as a special day.

4. **Breakfast assignment** — for each day:
   - Pick one dish from `breakfastDishes` not yet used in this period
   - If none available (all used), emit `INSUFFICIENT_BREAKFAST_VARIETY` warning and allow repeat
   - Track assigned IDs to prevent repeats

5. **Lunch assignment** — for each day:
   - If special day: assign the single `isSpecial` dish, nothing else
   - Otherwise:
     - Build the set of candidates that are simultaneously non-repeating
       (not yet used this period) and mutually flavor-clean.
     - If ≥3 such candidates exist, call `random()`; if the result is
       `< LUNCH_THREE_DISH_PROBABILITY`, assign 3, otherwise assign 2.
     - If exactly 2 (or fewer than 3) such candidates exist, assign 2 if
       possible.
     - If fewer than 2 non-repeating, flavor-clean candidates exist, relax
       in this order: first allow a flavor collision (emit
       `FLAVOR_COLLISION_RELAXED`), then allow a repeat if still short
       (emit `REPEAT_FORCED`).

6. **Shopping list** — collect all ingredients from all assigned dishes, deduplicate by ingredient name, snapshot dish name.

### Implementation Notes

- All shuffling and all probabilistic branching (weekend selection, 2-vs-3
  lunch sizing) must call the injected `random()` — never `Math.random()`
  directly — so a fixed seed in tests produces fully deterministic output.
- Shuffle dish pools once at start (via `random()`), then consume in order.
- Track `assignedBreakfastIds: Set<string>` and `assignedLunchIds: Set<string>` across the full period.

**Files:**
- `lib/planner/generate.ts` (create)

---

## Step 6: Test Fixtures (`lib/planner/fixtures.ts`)

**Action:** Pre-built dish libraries for testing each scenario.

| Fixture | Purpose | Breakfast count | Lunch count | Special? | Notes |
|---|---|---|---|---|---|
| `tooSmallLibrary` | Triggers pre-flight gate | 0 | 1 | No | Blocked: <1 Breakfast AND <2 Lunch |
| `noSpecialLibrary` | No Special dish available | 2 | 4 | No all `isSpecial=false` | Should emit `NO_SPECIAL_DISH` warning |
| `singleFlavorLibrary` | Forces flavor-uniqueness relaxation | 3 | 6 | 1 Special | All dishes share `"salty"` flavor |
| `barelySufficientLibrary` | Just enough to fill 14 days | 14 | 28 | 1 Special | Exactly 14 breakfasts, 28 lunches; no room for repeats |
| `normalLibrary` | Happy path | 8 | 15 | 3 Special | Plenty of variety, multiple flavors |

Each fixture returns `PlannerDish[]`.

**Files:**
- `lib/planner/fixtures.ts` (create)

---

## Step 7: Unit Tests (`lib/planner/generate.test.ts`)

**Action:** Comprehensive test suite covering all rules and edge cases. Every
test that asserts a specific dish count, dish identity, or warning presence
must pass a fixed `random` function in `GenerationInput` — no test should
rely on default `Math.random()` and an assertion that could flake.

### Test Groups

**Pre-flight gate:**
- `it("blocks when library has 0 Breakfast dishes")`
- `it("blocks when library has < 2 Lunch dishes")`
- `it("passes with valid library")`
- `it("throws PreFlightGateError with the gate's error messages when blocked")`

**Special Day:**
- `it("places exactly one special day per 14-day window on a weekend")`
- `it("places 2 special days across a 28-day plan, one per window")`
- `it("places no special day in a short trailing window with no weekend day")`
- `it("emits NO_SPECIAL_DISH warning exactly once when no special dish exists, regardless of duration")`
- `it("assigns single special dish to special day's lunch")`

**Breakfast:**
- `it("assigns 1 breakfast dish per day")`
- `it("does not repeat breakfast dishes within the period")`
- `it("emits INSUFFICIENT_BREAKFAST_VARIETY when repeat is forced")`

**Lunch:**
- `it("assigns 2 lunch dishes per non-special day when random() is above the 3-dish threshold")`
- `it("assigns 3 lunch dishes when random() is below the 3-dish threshold and ≥3 valid candidates exist")`
- `it("never assigns 3 dishes when fewer than 3 valid candidates exist, even if random() favors it")`
- `it("assigns 1 dish on special day")`
- `it("does not repeat lunch dishes within the period")`
- `it("emits REPEAT_FORCED when lunch variety is insufficient")`
- `it("enforces flavor uniqueness within a lunch slot")`
- `it("emits FLAVOR_COLLISION_RELAXED when flavors collide")`

**Shopping list:**
- `it("deduplicates ingredients across dishes")`
- `it("snapshots dish name for each ingredient")`

**Edge cases:**
- `it("handles 1-day duration")`
- `it("handles 7-day duration")`
- `it("handles 14-day duration")`
- `it("handles 28-day duration (two 2-week cycles)")`
- `it("handles 20-day duration (one full window + a 6-day trailing window)")`

**Files:**
- `lib/planner/generate.test.ts` (create)

---

## Files Summary

| File | Action | Description |
|---|---|---|
| `package.json` | Modify | Add vitest devDep + test script |
| `vitest.config.ts` | Create | Minimal Vitest config |
| `lib/planner/types.ts` | Create | PlannerDish, GenerationInput (incl. `random?`), GenerationOutput, PlannerWarning |
| `lib/planner/gate.ts` | Create | Pre-flight gate check (pure predicate, never throws) |
| `lib/planner/rules.ts` | Create | Flavor collision, repeat detection |
| `lib/planner/generate.ts` | Create | Main generation algorithm + `PreFlightGateError` |
| `lib/planner/fixtures.ts` | Create | Test fixture dish libraries |
| `lib/planner/generate.test.ts` | Create | Full Vitest test suite |
| `.agents/context/features/04-planner-core.md` | Update | This revised plan document |
| `.agents/context/progress-tracker.md` | Update | Mark Phase 4 complete; clear the open questions this resolved |

---

## Verification Checklist

Before moving to Phase 5:

1. `npx vitest run` — all tests pass
2. `pnpm run typecheck` — zero errors
3. `pnpm run build` — passes
4. `lib/planner/` has zero imports from `next`, `next-auth`, or `@prisma/client`
5. `progress-tracker.md` updated

---

## Open Questions

- None — both items open in the prior draft (shuffle seeding, lunch dish
  count trigger) are resolved above in **Design Decisions**.