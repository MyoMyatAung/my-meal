# Phase 8 — Dish Pairing + Updated Plan Generation Rules

## Goal

Add a symmetric dish-pairing relationship to the library, and rewrite Lunch
generation so the mandatory Side/Soup slot is drawn from the selected Main
course's pairings — replacing Phase 4's category-blind dish pool with a
category-aware, pairing-aware algorithm. This is a rewrite of already-shipped,
tested code (`lib/planner/*`), not an additive feature.

## Source

`Pairing Dish (Dish mapping) & Plan Generation rules` (project doc), resolved
against `project-overview.md`, `architecture.md`, `code-standards.md`,
`ai-workflow-rules.md`, and the existing Phase 3/4 implementations, per
`ai-workflow-rules.md`'s rule to resolve ambiguity here rather than mid-build.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pairing scope | Generic `Dish` ↔ `Dish` relation, not restricted to Main↔X at the DB or Zod level | Confirmed by user. Matches "multiple perfect pairing dishes" language; category restriction (if any) lives in the UI layer, not the schema. |
| Pairing storage | **One canonical row per unordered pair** (`dishAId`, `dishBId`, sorted so `dishAId < dishBId`), not two directional rows | Confirmed by user. Eliminates dual-write sync bugs — editing either dish's pairing list touches the same row. |
| Pairing table `userId` | **No independent `userId` column** — ownership enforced via the parent `Dish.userId` at the Server Action boundary | Matches the established junction-table pattern in this codebase: `DishFlavor` and `DishIngredient` (see `03-dish-library.md`'s schema table) carry no `userId` of their own either. A new column here would be an unexplained inconsistency. |
| Rule doc wording | "no flavor duplication is not allowed" → **"flavor duplication is not allowed"** (typo) | Confirmed by user. |
| Fallback: Main has no paired Side/Soup | **Fall back to Phase 4's old flavor-based pick** (any non-repeating, flavor-clean Side/Soup dish) + emit `NO_PAIRED_DISH_FALLBACK` warning | Confirmed by user. Critical for day-one usability: every dish starts with zero pairings, so this path is the *common* case until users invest in pairing their library, not an edge case. |
| Weekly no-repeat rule | **Lunch only.** Rolling 7-day blocks anchored to `startDate` (Day 1–7, 8–14, ...), not real calendar weeks | Confirmed by user. Mirrors the existing 14-day Special Day windowing pattern in `generate.ts` — same anchoring logic, half the size, so the codebase now has one consistent "chunk from start date" idiom instead of two different windowing strategies. Breakfast keeps its original whole-period no-repeat behavior, unchanged. |
| Optional 3rd lunch dish | **Compensatory only** — attempted *only* when Main+Side/Soup ended up sharing a flavor, and only as a flavor-clean pick from Snack/Accompaniment/Other. Never added when Main+Side/Soup are already flavor-clean. | Confirmed by user. Directly matches the rule doc's own wording: "If the side dish or soup has the same flavor with paired main course, the planner has to choose snacks, accompaniments and other with different flavors." Replaces `LUNCH_THREE_DISH_PROBABILITY`'s independent ~20% roll entirely — that constant is removed. |
| Manual edit/swap | **Unaffected by pairing.** `getSwappableDishes` stays scoped to same-`mealTime` candidates only; no pairing-aware filtering, sorting, or warning added. | Confirmed by user. Matches `architecture.md` invariant 5 — edit doesn't enforce balance rules, generation does. Pairing only shapes generation. |
| Pre-flight gate | Replace the old "≥2 Lunch dishes" check with **"≥1 Main dish" AND "≥1 Side-or-Soup dish"** (both `mealTime = Lunch`) | Forced consequence of Main+Side/Soup both being mandatory per lunch — 2 arbitrary Lunch dishes (e.g. two Snacks) no longer guarantees a generatable lunch. Breakfast's `≥1` check is unchanged. |
| Pairing candidates | **Lunch dishes only** — enforced at **both** layers: the combobox only ever offers non-archived, `mealTime = Lunch` dishes (any category), and `createDish`/`updateDish` reject any `pairedDishIds` entry that resolves to a Breakfast dish, same two-layer pattern as the existing Special/Breakfast refine in `03-dish-library.md` | Confirmed by user. Breakfast dishes are never consulted by the generator (breakfast has no second dish), so a Breakfast pairing could never do anything — rejecting it server-side matches `code-standards.md`'s "validate unknown input... at the boundary," not just a UI nicety. |
| Flavor-collision warning code | **Reuse `FLAVOR_COLLISION_RELAXED`**, fired whenever Main+Side/Soup end up sharing a flavor — whether by the deliberate 30% roll or by forced relaxation (no flavor-clean paired option existed) | One code, one meaning ("this lunch has a flavor collision, and here's why it was allowed"), rather than splitting "intentional" vs "forced" into separate codes the UI would need to explain differently. `project-overview.md`'s transparency principle just needs *a* visible warning, not a taxonomy of causes. |
| Compensatory dish must also be paired | **The 3rd (compensatory) dish must be paired to *both* the chosen Main and the chosen Side/Soup** — i.e. its id appears in the intersection of `main.pairedDishIds` and `sideOrSoup.pairedDishIds`, not just any flavor-clean Snack/Accompaniment/Other | Confirmed by user: "the third dish should be chosen that's paired to the previous two dishes." Read as *paired to both*, not just one — consistent with "perfect pairing" being about a cohesive combination, not a chain of unrelated pairwise links. |
| Compensatory-dish fallback | **Same fallback pattern as Main→Side/Soup**: if the intersection is empty, fall back to Phase 4's flavor-clean, non-repeating pick from the general Snack/Accompaniment/Other pool, reusing the `NO_PAIRED_DISH_FALLBACK` code (message text distinguishes which slot fell back) | Confirmed by user. Keeps the compensatory dish's graceful-degradation behavior consistent with the Main→Side/Soup path — a strict no-fallback reading would mean the compensatory dish almost never appears until a user has triple-paired three specific dishes, undercutting why the rule exists. |

---

## Schema Changes (Prisma) — confirmed, implementing

`prisma/schema.prisma` is a protected file per `ai-workflow-rules.md` — change
approved. Diff below; the standalone file delivered alongside this doc has
the exact model block to merge in (no new fields needed for the "compensatory
dish must be paired to both" rule — it's the same `DishPairing` table,
queried twice).

```prisma
model Dish {
  // ...existing fields unchanged...

  pairingsAsA DishPairing[] @relation("DishPairingA")
  pairingsAsB DishPairing[] @relation("DishPairingB")
}

model DishPairing {
  id      String @id @default(cuid())
  dishAId String
  dishBId String

  dishA Dish @relation("DishPairingA", fields: [dishAId], references: [id], onDelete: Cascade)
  dishB Dish @relation("DishPairingB", fields: [dishBId], references: [id], onDelete: Cascade)

  @@unique([dishAId, dishBId])
  @@index([dishBId])
}
```

- Canonical ordering (`dishAId < dishBId`, plain string comparison — no
  semantic meaning needed, just consistency) is enforced in the Server Action,
  not the DB — Postgres has no portable "sort two columns on insert" constraint.
- `onDelete: Cascade` on both sides: dishes are never hard-deleted in v1
  (`architecture.md` invariant 2 — always `isArchived = true`), so this is a
  safety net for referential integrity, not a path that fires in normal use.
  Archiving a dish does **not** delete its `DishPairing` rows — they just
  become inert, since archived dishes are already excluded from generation
  input. Same "soft delete never breaks other references" philosophy as
  Invariant 2, extended here rather than special-cased.
- Migration name suggestion: `add_dish_pairing`.

---

## Sub-phase Split

Per `ai-workflow-rules.md`: Server Action before UI, `lib/planner/` verified
against fixtures before anything is wired to it, `app/dishes/` and `app/plan/`
are separate boundaries even though this feature touches both.

- **8A — Dish pairing data layer**: schema + `dishes.ts` symmetric sync logic.
  No UI. Verify with a throwaway smoke check before touching `lib/planner/`.
- **8B — Planner core rewrite**: `types.ts`, `gate.ts`, `rules.ts`,
  `generate.ts`, `fixtures.ts`, `generate.test.ts`. Depends on 8A's shape for
  `pairedDishIds`, but is otherwise independently testable with fixtures —
  same discipline as Phase 4. **Must pass in isolation before Phase 5's
  `generatePlanAction` or the Dashboard gate banner are touched.**
- **8C — Dish form UI**: pairing combobox in `dish-dialog.tsx`, wired to 8A.
  Depends on 8A only, not 8B.
- **8D — Dashboard/gate banner update**: reflect the new category-aware gate
  messages. Small, depends on 8B.

---

## Phase 8A — Dish Pairing Data Layer

### `lib/zod/dish.ts` (modify)

Add to `DishSchema`:
```typescript
pairedDishIds: z.array(z.string().cuid()).max(20).default([])
```

### `app/actions/dishes.ts` (modify)

- `createDish` / `updateDish`: after persisting the dish itself, diff its
  desired pairing set against existing `DishPairing` rows (`WHERE dishAId = id
  OR dishBId = id`), same delete-then-create pattern already used for flavors:
  - Reject (return `{ success: false, error }`) if any `pairedDishIds` entry
    doesn't belong to `session.user.id`, or isn't `mealTime = Lunch`.
  - For each surviving target id: `[id, targetId].sort()` → canonical
    `(dishAId, dishBId)` → upsert.
  - Delete rows for pairings that were removed.
- `getDishById` / `getDishes`: extend `DishWithRelations` with
  `pairedDishes: { id: string; name: string; category: Category }[]`
  (resolved from both `pairingsAsA`/`pairingsAsB`, normalized to "the other
  dish" regardless of which side the query hit) — needed by both the edit
  form (8C) and the planner input mapper (8B/Phase 5's `generatePlanAction`).

---

## Phase 8B — Planner Core Rewrite

### `lib/planner/types.ts` (modify — breaking change to an already-tested type)

```typescript
type Category = "MAIN" | "SIDE" | "SOUP" | "SNACK" | "ACCOMPANIMENTS" | "OTHER"
// Redeclared locally, not imported from @prisma/client — same reason
// mealTime is `"Breakfast" | "Lunch"` here instead of the Prisma enum:
// architecture.md invariant 1, zero framework imports in lib/planner/.

interface PlannerDish {
  id: string
  name: string
  category: Category                // NEW
  mealTime: "Breakfast" | "Lunch"
  isSpecial: boolean
  flavors: string[]
  ingredientNames: string[]
  pairedDishIds: string[]           // NEW — symmetric, IDs of paired dishes
}

type WarningCode =
  | "INSUFFICIENT_BREAKFAST_VARIETY"
  | "FLAVOR_COLLISION_RELAXED"
  | "NO_SPECIAL_DISH"
  | "REPEAT_FORCED"
  | "NO_PAIRED_DISH_FALLBACK"        // NEW
```

`PlannerEntryDish`/`PlannerEntry` stay as-is — a dish's role (Main vs
Side/Soup vs compensatory) is conveyed by `sortOrder` (0 = Main, 1 =
Side/Soup, 2 = optional), not a new field, to avoid touching output types
that `edit-warnings.ts` and the UI already consume.

### `lib/planner/gate.ts` (modify)

```typescript
const MIN_BREAKFAST_DISHES = 1        // unchanged
const MIN_MAIN_DISHES = 1             // NEW — replaces part of the old MIN_LUNCH_DISHES check
const MIN_SIDE_OR_SOUP_DISHES = 1     // NEW — replaces the other part

function checkPreFlightGate(dishes: PlannerDish[]): GateResult
```

- Blocked if `< MIN_BREAKFAST_DISHES` Breakfast dishes (unchanged message).
- Blocked if `< MIN_MAIN_DISHES` dishes with `category === "MAIN"` (and
  `mealTime === "Lunch"`) — `"Not enough Main dishes (need at least 1, have 0)"`.
- Blocked if `< MIN_SIDE_OR_SOUP_DISHES` dishes with `category` in
  `["SIDE", "SOUP"]` — `"Not enough Side or Soup dishes (need at least 1, have 0)"`.
- `MIN_LUNCH_DISHES` (old exported constant, currently consumed by the
  Dashboard banner) is **removed** — Phase 8D updates that consumer.

### `lib/planner/rules.ts` (modify — additive)

```typescript
/** Do two dishes share at least one flavor? */
function sharesFlavor(a: { flavors: string[] }, b: { flavors: string[] }): boolean

/**
 * Picks the mandatory Side/Soup dish for a given Main course.
 * - candidates: dishes already filtered to category SIDE|SOUP, non-archived,
 *   mealTime Lunch
 * - pairedIds: main.pairedDishIds, as a Set for lookup
 * - weekAssignedIds: dishes already used in the current 7-day block
 * - preferSameFlavor: the resolved 0.3-roll outcome for this pick
 * Returns the chosen dish plus which relaxations (if any) were needed, so
 * generate.ts can decide which warnings to emit — this function stays pure
 * and doesn't push warnings itself, consistent with the rest of rules.ts.
 */
function pickPairedSideOrSoup(args: {
  main: PlannerDish
  candidates: PlannerDish[]
  weekAssignedIds: Set<string>
  preferSameFlavor: boolean
}): {
  dish: PlannerDish | null
  usedFallback: boolean   // true if no paired candidate existed at all
  forcedRepeat: boolean   // true if weekAssignedIds had to be ignored
}

/**
 * Picks the optional compensatory 3rd dish — must be paired to BOTH main
 * and sideOrSoup (intersection of their pairedDishIds), category in
 * {SNACK, ACCOMPANIMENTS, OTHER}, and flavor-clean against both. Falls back
 * to an unpaired flavor-clean pick from the same category pool if the
 * intersection yields nothing.
 */
function pickCompensatoryDish(args: {
  main: PlannerDish
  sideOrSoup: PlannerDish
  candidates: PlannerDish[]   // pre-filtered to SNACK|ACCOMPANIMENTS|OTHER, non-archived, Lunch
  weekAssignedIds: Set<string>
}): {
  dish: PlannerDish | null   // null if no valid candidate exists at all, even via fallback
  usedFallback: boolean      // true if the intersection was empty and we fell back
}
```

`hasFlavorCollision` and `wouldRepeat`/`pickNonRepeatDish` are unchanged —
still generic over whatever `Set` the caller passes, which is exactly what
lets `generate.ts` hand them a per-week Set for Lunch and a period-wide Set
for Breakfast without any change to their signatures.

### `lib/planner/generate.ts` (rewrite — Lunch assignment only; Breakfast, gate call, and Special Day placement steps 1–4 are unchanged from Phase 4)

Named constant: `MAIN_SIDE_SAME_FLAVOR_PROBABILITY = 0.3` (replaces the
removed `LUNCH_THREE_DISH_PROBABILITY = 0.2`).

**Lunch assignment, per non-special day:**

1. Determine this day's 7-day block index (`Math.floor(dayIndexInPlan / 7)`).
   On entering a new block, reset `weekLunchIds: Set<string>` to empty —
   mirrors the existing 14-day window chunking already in this file for
   Special Day, just applied to a second, independent windowing concern.
2. **Pick Main** — random non-repeating (this week) dish where
   `category === "MAIN"`. If every Main dish has been used this week, relax:
   allow a repeat, emit `REPEAT_FORCED`.
3. **Pick Side/Soup**, via `pickPairedSideOrSoup`:
   - Candidate pool: Main's `pairedDishIds` resolved to actual dishes, filtered
     to `category ∈ {SIDE, SOUP}`.
   - Roll `random()`; if `< MAIN_SIDE_SAME_FLAVOR_PROBABILITY`, prefer a
     candidate that shares a flavor with Main; otherwise prefer one that
     doesn't. If the preferred subset is empty, use the other subset.
   - Non-repeating (this week) preferred; if every paired candidate was
     already used this week, relax and allow a repeat (`REPEAT_FORCED`).
   - If Main has **no** paired Side/Soup candidates at all (empty
     `pairedDishIds` intersected with Side/Soup, or literally zero pairings),
     fall back to the full library's Side/Soup dishes using Phase 4's old
     flavor-based, non-repeating-preferred logic, and emit
     `NO_PAIRED_DISH_FALLBACK`.
4. If Main and the chosen Side/Soup share a flavor (by either path above),
   emit `FLAVOR_COLLISION_RELAXED` once for this entry, and mark
   `flavorCollisionOccurred = true`.
5. **Compensatory 3rd dish** — only attempted if `flavorCollisionOccurred`,
   via `pickCompensatoryDish`:
   - Candidate pool: non-archived, `mealTime = Lunch` dishes with
     `category ∈ {SNACK, ACCOMPANIMENTS, OTHER}`.
   - Preferred set: candidates whose id is in **both** `main.pairedDishIds`
     and `sideOrSoup.pairedDishIds` (paired to the previous two dishes, not
     just one), non-repeating this week, flavor-clean against both.
   - If that intersection is empty, fall back to the same category pool
     without the pairing requirement — still flavor-clean against both,
     still non-repeating-preferred — and emit `NO_PAIRED_DISH_FALLBACK`
     (message identifies it as the compensatory slot, distinct from a
     Main/Side/Soup fallback in the same entry).
   - If a candidate is found (either path), add it — lunch → 3 dishes. If
     none exists even via fallback, lunch stays at 2 — no additional
     warning beyond the `FLAVOR_COLLISION_RELAXED` already emitted in step 4
     (see Design Decisions).
6. Add every dish chosen this day (including a Special day's single dish) to
   `weekLunchIds`.

**Everything else — pre-flight gate call, Breakfast loop (still period-wide,
untouched), Special Day window/placement logic, shopping list aggregation —
is unchanged from Phase 4.**

### `lib/planner/fixtures.ts` (modify — breaking update to every existing fixture)

- Every existing fixture (`tooSmallLibrary`, `noSpecialLibrary`,
  `singleFlavorLibrary`, `barelySufficientLibrary`, `normalLibrary`) needs
  `category` and `pairedDishIds` added to each `PlannerDish` — this alone is
  enough to break compilation until done, so it's step zero of 8B.
- New fixtures:

| Fixture | Purpose |
|---|---|
| `noMainLibrary` | Triggers new gate: 0 Main dishes |
| `noSideOrSoupLibrary` | Triggers new gate: 0 Side/Soup dishes |
| `unpairedMainLibrary` | Main dishes exist, zero `DishPairing` rows anywhere — exercises `NO_PAIRED_DISH_FALLBACK` |
| `pairedMixedFlavorLibrary` | Mains paired to both same-flavor and different-flavor Side/Soup dishes, plus flavor-clean Snack/Accompaniment/Other options — exercises both branches of the 0.3 roll |
| `triplePairedLibrary` | A Main + Side/Soup pair that share a flavor (forces `flavorCollisionOccurred`), plus a Snack/Accompaniment/Other dish explicitly paired to **both** of them and flavor-clean against both — exercises the intersection-based compensatory pick deterministically |
| `compensatoryFallbackLibrary` | Same flavor-collision setup as above, but the only flavor-clean Snack/Accompaniment/Other dish is paired to just *one* of the two (or neither) — exercises the compensatory-dish `NO_PAIRED_DISH_FALLBACK` path |
| `weeklyRepeatLibrary` | Small pool (e.g. 2 Mains, 2 Side/Soups) — sufficient for one 7-day block without relaxation, but would have needed `REPEAT_FORCED` under Phase 4's old *period*-wide rule over 14+ days. Proves the window actually resets rather than just being period-wide with new terminology. |

### `lib/planner/generate.test.ts` (modify — new/changed test groups)

- **Gate**: `blocks when library has 0 Main dishes`, `blocks when library has
  0 Side/Soup dishes`, `passes with 1 Main + 1 Side + 1 Breakfast` (old "≥2
  Lunch dishes" tests removed/replaced).
- **Pairing**: `picks Side/Soup from Main's pairedDishIds when available`,
  `falls back to flavor-based pick + NO_PAIRED_DISH_FALLBACK when Main has no
  pairings`, `prefers same-flavor pairing when random() < 0.3 and a
  same-flavor candidate exists`, `prefers different-flavor pairing otherwise`,
  `emits FLAVOR_COLLISION_RELAXED whenever Main and Side/Soup share a flavor,
  regardless of cause`.
- **Compensatory dish**: `adds a 3rd dish only when Main+Side collided`,
  `never adds a 3rd dish when Main+Side were already flavor-clean`, `prefers
  a dish paired to both Main and Side/Soup over an unpaired flavor-clean
  candidate`, `falls back to an unpaired flavor-clean pick + NO_PAIRED_DISH_FALLBACK
  when no dish is paired to both`, `stays at 2 dishes when no valid
  compensatory candidate exists via either path`.
- **Weekly repeat**: `resets the no-repeat window every 7 days`, `does not
  force a repeat within a single 7-day block if the pool is sufficient for
  that block, even if it would have been insufficient for the whole period
  under the old rule`, `emits REPEAT_FORCED only when a single 7-day block's
  pool is insufficient`.
- **Breakfast**: unchanged — still period-wide, existing tests untouched.
- Re-run full suite (46 existing tests) to confirm nothing outside Lunch
  assignment shifted.

---

## Phase 8C — Dish Form UI

- New `components/dish-pairing-combobox.tsx`, same interaction shape as the
  existing ingredient combobox (search-or-select, badge list of selections) —
  but no "create" affordance, since pairing targets must already exist as
  dishes. Candidates: `getDishes({ mealTime: "Lunch" })` minus the dish
  currently being edited, minus archived.
- Wire into `dish-dialog.tsx`, gated to render only when the form's
  `mealTime === "Lunch"` (a Breakfast dish has nothing to pair).
- Optional, low-effort: a small "Paired with: X, Y" line on `dish-card.tsx`
  when `pairedDishes.length > 0` — flagging as nice-to-have, not required for
  acceptance.

## Phase 8D — Dashboard Gate Banner Update

- `app/(dashboard)/page.tsx`: replace the `MIN_LUNCH_DISHES`-based message
  with the two new named checks (Main / Side-or-Soup), each naming what's
  missing — consistent with `project-overview.md` success criterion 3
  ("specific, actionable message... naming what's missing").
- `getDishCounts` in `app/actions/plan.ts`: extend to return per-category
  counts needed by the banner.

---

## Deferred / Explicitly Out of Scope for Phase 8

- Visual grouping of Main/Side/Snack roles in `day-card.tsx` (currently
  renders lunch dishes as an undifferentiated pill row) — `sortOrder` already
  encodes role, so this is a pure UI enhancement addable later without
  touching the planner again.
- Pairing-aware sorting or nudges in the manual swap dropdown (explicitly
  decided against this phase — see Design Decisions).
- Any change to `edit-warnings.ts` — weekly-repeat detection for the *edit*
  flow (as opposed to generation) was not part of the confirmed scope; edit's
  repeat-check still means "elsewhere in the whole plan," not "elsewhere this
  week." Worth a follow-up decision later if it's felt inconsistent.

---

## Files Summary

| File | Action |
|---|---|
| `prisma/schema.prisma` | Modify — `DishPairing` model + `Dish` relations (**confirm before applying**) |
| `lib/zod/dish.ts` | Modify — `pairedDishIds` on `DishSchema` |
| `app/actions/dishes.ts` | Modify — symmetric pairing sync, `pairedDishes` on `DishWithRelations` |
| `lib/planner/types.ts` | Modify — `category`/`pairedDishIds` on `PlannerDish`, new `WarningCode` |
| `lib/planner/gate.ts` | Modify — category-aware minimums |
| `lib/planner/rules.ts` | Modify — `sharesFlavor`, `pickPairedSideOrSoup` |
| `lib/planner/generate.ts` | Modify — Lunch assignment rewrite, weekly windowing |
| `lib/planner/fixtures.ts` | Modify — update existing + 5 new fixtures |
| `lib/planner/generate.test.ts` | Modify — new/changed test groups |
| `components/dish-pairing-combobox.tsx` | Create |
| `components/dish-dialog.tsx` | Modify — wire combobox |
| `components/dish-card.tsx` | Modify (optional) — paired-with line |
| `app/actions/plan.ts` | Modify — `generatePlanAction` input mapping, `getDishCounts` |
| `app/(dashboard)/page.tsx` | Modify — new gate banner messages |
| `progress-tracker.md` | Update — mark Phase 8 sub-units complete as they land |

---

## Acceptance Criteria

- [x] Adding Dish A → paired to Dish B makes Dish B show A as paired, with no
      manual sync step, immediately after save
- [x] Removing a pairing from either dish's form removes it from both
- [x] A direct `updateDish` call with a Breakfast dish's id in `pairedDishIds`
      is rejected server-side
- [x] Generation blocks with a specific message when the library has 0 Main
      dishes, and separately when it has 0 Side/Soup dishes
- [x] A Main with real pairings picks its Side/Soup from that pairing set;
      one with zero pairings falls back to the old flavor-based pick and the
      plan surfaces `NO_PAIRED_DISH_FALLBACK`
- [x] Across a large fixture, roughly 30% of non-fallback Main/Side picks
      share a flavor (statistical, checked via a fixed-seed test, not exact)
- [x] A 3rd lunch dish appears only on days where Main+Side collided on
      flavor, never otherwise
- [x] When a 3rd dish is added, it's one paired to *both* the Main and the
      Side/Soup whenever such a dish exists; falls back to an unpaired
      flavor-clean pick (with `NO_PAIRED_DISH_FALLBACK`) only when no
      doubly-paired option exists
- [x] No dish repeats within any single 7-day block of the plan; the same
      dish *can* reappear in week 2
- [x] Breakfast's no-repeat behavior is provably unchanged (existing tests
      still pass as-is)
- [x] Manual swap dropdown behavior and warnings are provably unchanged
      (existing Phase 6 tests/flows still pass as-is — `getSwappableDishes`/
      `swapDishAction` untouched in this phase)

## Verification Checklist

Same as every prior phase, per `ai-workflow-rules.md`:

1. [x] `npx vitest run` — all tests pass, including the full pre-existing suite (64/64)
2. [x] `pnpm run typecheck` — zero errors
3. [x] `pnpm run build` — passes
4. [x] `lib/planner/` still has zero imports from `next`, `next-auth`, or
   `@prisma/client`
5. [x] `progress-tracker.md` updated