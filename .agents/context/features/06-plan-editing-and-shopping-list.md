# Phase 6 — Plan Editing + Shopping List

> **Revision note (v2):** this supersedes the original draft. Three
> implementation decisions were resolved after review — shopping list
> resync on swap, toast feedback on swap failure, and a single
> deduplicated warnings carousel replacing two separate banner types.
> See the **Design Decisions** table below for all three, flagged inline.

## Goal

Let a user swap any dish in any slot of the current plan for another dish
of the same meal time, with balance-rule violations surfaced as
non-blocking warnings (edit still saves). Build the shopping list screen:
one deduplicated, checkable ingredient list per plan that **stays in sync
with the plan's current dishes** — including after a swap — with per-item
checked state that persists for every ingredient that remains required.

## Deliverable

`/plan/edit` — per-slot dish swapping with a consolidated, swipeable
violation-warnings carousel; failed swaps surface via toast instead of
silently no-oping.
`/shopping-list` — checklist view that stays synchronized with the plan's
current dishes (updated automatically whenever a swap changes what's
needed), with working check-off that survives a refresh.

---

## Flow (from prototypes)

```
Plan (/plan)
  └── "Edit plan" button (currently disabled) → /plan/edit

Edit plan (/plan/edit)
  ├── ← Plan view
  ├── Warnings carousel (if any) — swipeable, one card per unique
  │     violation, deduplicated across generation + edit sources
  ├── Day cards, every dish pill has a pencil icon
  ├── Click pencil → pill becomes a Select of same-meal-time dishes
  ├── Pick a dish → saved immediately (swapDishAction), which also
  │     resyncs the shopping list in the same transaction
  ├── Any resulting rule violation → surfaces in the warnings carousel
  │     above; the affected day card gets a border tint + icon only
  │     (violation never blocks the save)
  ├── Swap fails → toast error, Select reverts to the prior value
  └── "Done" → /plan

Shopping list (/shopping-list)
  ├── No current plan → empty state, link to /plan
  └── Has current plan → checklist, "X of Y checked" counter
        each row toggles isChecked (toggleShoppingItemAction)
        list reflects the plan's *current* dishes — kept in sync by
        swapDishAction, not a frozen generation-time snapshot
```

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Edit-time rule checking | **Reuse `lib/planner/rules.ts`** (`hasFlavorCollision`, and the same existence-check idea behind `wouldRepeat`), not a new rule engine. | `architecture.md` states these functions are explicitly meant to be "reused by both generation and manual-edit validation" — this phase is that reuse, not a new subsystem. |
| `hasFlavorCollision` signature | **Widen its parameter type** from `PlannerDish[]` to `{ flavors: string[] }[]` in `rules.ts`. Purely additive — the function body only ever reads `.flavors`, so every existing caller (`PlannerDish[]`) still satisfies the new, looser type. | Edit-time dish data has no `mealTime`/`isSpecial`/`ingredientNames` to offer — forcing a full `PlannerDish` shape here would mean fabricating throwaway fields just to satisfy the type. Re-run `npx vitest run` after this change since it touches an already-tested Phase 4 file. |
| Where violations are computed | **Server-side, on every `getCurrentPlan()` fetch** (not persisted, not client-side). A new pure function, `computeEntryWarnings`, takes a plain-data snapshot of the plan's entries (dish id/name/flavors per entry) and returns a `Map<entryId, string[]>`. `getCurrentPlan()` attaches the resulting array to each entry as `entryWarnings: string[]`. | Two options were considered: (a) persist a warning on `MealPlanEntry` at edit time, or (b) recompute live from current entry state. (a) needs a schema change (protected file) and can go stale the moment a *later* edit fixes the violation. (b) needs no schema change, is always accurate, and self-heals the moment the colliding/repeating dish is swapped again — strictly better here. Flavor names are only needed for this computation, so they're fetched and consumed server-side and never sent to the client. |
| Two violation categories checked on edit | **(1) Lunch flavor collision within one entry, (2) same dish appearing in more than one entry of the same meal time across the whole plan (repeat).** No check for "special day" integrity. | These are the two rules an edit can newly introduce (`project-overview.md`: "no repeats within the period", "all flavors distinct within that lunch"). Special Day is a generation-time placement concept with no DB column — editing a special day's dish to a non-special one just means the day stops rendering as special; nothing in the spec calls this out as a violation worth a warning, so it's left as an accepted, undocumented-as-a-rule side effect rather than invented behavior. |
| Slot count on edit | **Never changes.** Edit only replaces the dish inside an existing `MealPlanEntryDish` row — it cannot add or remove a lunch slot (2 vs 3 dishes) or convert a special day into a multi-dish one. | `project-overview.md`: "Swap any dish in any slot for another dish of the same meal time" — no mention of adding/removing slots. Matches the invariant that only regeneration changes plan shape; edit is fine-grained, not structural. |
| Duplicate dish within one entry | **Hard-blocked, not a soft warning.** The Select offered for one lunch slot excludes whichever dish(es) already occupy the *other* slot(s) in that same entry. | Two identical dishes in the same lunch isn't a "balance" violation to relax with a warning — it's not a state the UI should let you reach at all, since nothing in the spec describes a lunch with a repeated dish in itself. |
| Archived-dish edge case | **The Select's option list is always `swappable dishes ∪ {currently-assigned dish}`,** even if that dish has since been archived. | `architecture.md` Invariant 2: an archived dish's existing plan reference must keep resolving and rendering correctly. If the dropdown only listed active dishes, an already-placed-then-archived dish would vanish from its own slot's option list, breaking that invariant the moment the Edit screen is opened. |
| **Warning display consolidation** | **One `PlanWarningsCarousel`, not two separate banner types.** `MealPlan.warnings` (persisted, generation-time) and `entryWarnings` (live, per-entry) are merged and deduplicated by message text into a single list of swipeable cards — see Step 10. Day cards keep only a border tint + icon indicator ("this day is affected"), never the full warning sentence. | Without this, the same violation could read out twice — once in a top banner, once in a day-card row — in slightly different words. A repeat-dish warning already pushes the *identical* message to two entries (Step 2), so grouping by text also collapses those into one card instead of two near-duplicates. **Flagged design addition, v2.** |
| "Cancel" button removed vs. prototype | **Single "Done" button, no "Cancel".** Each swap is saved immediately by its own Server Action call (`project-overview.md`: "the edit still saves"), so there is nothing pending to discard by the time a "Cancel" click would run. | The prototype's static demo shows both buttons doing the same no-op navigation; carrying "Cancel" over as-is would misleadingly imply undo capability that doesn't exist. Small, flagged UI deviation — same category as Phase 5's "Regenerate → Generate New Plan" rename. |
| `border-warning` / `bg-warning` / `text-warning` bug | **Fix on the Dashboard only.** These utility classes are already used twice (Dashboard's blocking banner, Plan view's generation-warnings banner) but no `--warning` token exists anywhere in `globals.css` — confirmed by grep. In Tailwind v4, an unrecognized utility name just generates no CSS, so both currently render with no color styling at all. The Dashboard's hard-gate banner is a different concept from the carousel below (a single, always-blocking message, not a list) — fix it in place: switch to `border-destructive/40 bg-destructive/5 text-destructive`. The Plan view's occurrence of this bug is moot — that banner is removed outright and replaced by the Warnings Carousel, which uses the same destructive tokens from the start. | `ui-context.md` has no `warning` role in its color table — only `destructive` exists, and it already has defined, contrast-checked light/dark values. This is a flagged design decision per `code-standards.md` ("if a component needs to diverge from its shadcn default... recorded in `ui-context.md`") — record it there once implemented. |
| **Swap failure UX** | **Toast error (`sonner`), not a silent Select close.** On `swapDishAction` failure, `EditableDishPill` calls `toast.error(result.error)`; the Select still reverts to the prior (correct) value, but the user now sees *why*. | The original silent-revert design matched no other failure pattern in the app — sign-up already shows inline errors on Server Action failure. A swap can legitimately fail for reasons outside the client's control (e.g. a dish archived by the same user in another tab between page load and swap), and a silent no-op there reads as a broken button. **Flagged design addition, v2.** |
| Shopping list route | **`app/(dashboard)/shopping-list/page.tsx`**, not the bare `app/shopping-list/` `architecture.md` literally names. | Same precedent already set, unflagged, by Phase 5's `app/plan/` → `app/(dashboard)/plan/` — the `(dashboard)` group only adds the shared sidebar layout; it doesn't change the conceptual boundary `architecture.md` describes. |
| Shopping list data source | **New `app/actions/shopping-list.ts`**, not reusing `getCurrentPlan()`. A dedicated `getCurrentShoppingList()` selects only `{ id, shoppingItems }` for the current plan. | `getCurrentPlan()` eagerly includes the full entries/dishes tree, which the shopping-list screen doesn't need — a dedicated lightweight query avoids overfetching for a screen that renders under its own route. |
| **Shopping list sync on swap** | **`swapDishAction` is a transaction** spanning `MealPlanEntryDish` and `ShoppingListItem`. After the swap, it recomputes the full set of ingredients required by the plan's *current* dishes (not just old-dish-vs-new-dish) and diffs it against existing shopping-list rows: newly-required → create (unchecked); no-longer-required-by-anything → delete, **even if it was checked**. Ingredients still required by any other dish in the plan are left untouched — `isChecked` survives. | User decision: once manual editing exists, the shopping list must track the plan's *current* dishes, not stay frozen at generation time — otherwise a swap leaves the list wrong (missing the new dish's ingredients, still listing the old dish's exclusive ones). Diffing against the whole plan's current dish set — not a naive old-dish/new-dish delta — is what correctly protects ingredients shared between multiple dishes from being wrongly dropped. **Flagged design addition, v2**, revises the original "single-row update" decision. |
| Check-off UX | **Optimistic client-side toggle** — the row flips instantly on click, `toggleShoppingItemAction` fires in the background, and the row reverts with an inline error only if the action fails. | A checklist used while physically shopping needs to feel instant; round-tripping through `router.refresh()` per tap (Phase 5's pattern for plan generation) would be a poor fit for a rapid-tap interaction, unlike the once-per-form generate/swap flows. |

**Known limitation, not blocking:** `ShoppingListItem.dishName` is a
required snapshot field ("which dish contributed this ingredient"). Rows
newly created by a swap correctly get `dishName: newDish.name`. Rows that
*survive* a swap keep whatever `dishName` was stored earlier — if that
ingredient's original contributing dish gets swapped away but a different,
still-present dish also needs it, the stored `dishName` can go stale. Zero
UI impact today since `ShoppingListView` never renders `dishName`, only
`ingredient.name` — revisit if that field is ever surfaced.

---

## Sub-phase Split

Per `ai-workflow-rules.md`: Server Actions verified before the UI that
calls them; `app/plan/` and a new `app/shopping-list/` are separate
boundaries.

- **6A — Data layer + rule reuse**: `rules.ts` signature widening,
  `lib/planner/edit-warnings.ts` (+ test), `getCurrentPlan` extension,
  `swapDishAction` (now a transaction that also resyncs the shopping list
  via `lib/utils/shopping-list-diff.ts`), `getSwappableDishes`,
  `app/actions/shopping-list.ts`. No UI.
- **6B — Plan editing UI**: `/plan/edit` page, editable day card / dish
  pill, the Warnings Carousel, toast setup, wiring the "Edit plan" button.
  Depends on 6A.
- **6C — Shopping list UI**: `/shopping-list` page, checklist component.
  Depends on 6A. Independent of 6B.

---

## Phase 6A — Data Layer + Rule Reuse

### Step 1: Widen `hasFlavorCollision`'s parameter type

**File:** `lib/planner/rules.ts` (modify)

```typescript
export function hasFlavorCollision(dishes: { flavors: string[] }[]): boolean {
  const allFlavors = dishes.flatMap((d) => d.flavors)
  return allFlavors.length !== new Set(allFlavors).size
}
```

Purely a type change — every existing `PlannerDish[]` caller (`generate.ts`) still satisfies `{ flavors: string[] }[]`. Re-run `npx vitest run` to confirm nothing shifted.

### Step 2: Edit-time warning computation

**File:** `lib/planner/edit-warnings.ts` (create)

```typescript
import { hasFlavorCollision } from "./rules"

export interface WarningEntryDish {
  dishId: string
  dishName: string
  flavors: string[]
}

export interface WarningEntry {
  entryId: string
  mealTime: "Breakfast" | "Lunch"
  dishes: WarningEntryDish[]
}

/**
 * Computes non-blocking rule-violation warnings per plan entry, from the
 * plan's *current* dish assignment — not a generation-time snapshot.
 * Reused by both the Plan view (read-only display) and the Edit view
 * (immediately after a swap).
 */
export function computeEntryWarnings(
  entries: WarningEntry[],
): Map<string, string[]> {
  const warnings = new Map<string, string[]>()
  const push = (entryId: string, message: string) => {
    warnings.set(entryId, [...(warnings.get(entryId) ?? []), message])
  }

  for (const entry of entries) {
    if (entry.mealTime !== "Lunch") continue
    if (hasFlavorCollision(entry.dishes)) {
      const flavor = findFirstDuplicateFlavor(entry.dishes)
      push(
        entry.entryId,
        flavor
          ? `Two lunch dishes share a flavor (${flavor}) — saved anyway`
          : "Two lunch dishes share a flavor — saved anyway",
      )
    }
  }

  const byMealTime = new Map<"Breakfast" | "Lunch", WarningEntry[]>()
  for (const entry of entries) {
    byMealTime.set(entry.mealTime, [
      ...(byMealTime.get(entry.mealTime) ?? []),
      entry,
    ])
  }

  for (const sameTime of byMealTime.values()) {
    const occurrences = new Map<string, { name: string; entryIds: Set<string> }>()
    for (const entry of sameTime) {
      for (const dish of entry.dishes) {
        const record = occurrences.get(dish.dishId) ?? {
          name: dish.dishName,
          entryIds: new Set<string>(),
        }
        record.entryIds.add(entry.entryId)
        occurrences.set(dish.dishId, record)
      }
    }
    for (const { name, entryIds } of occurrences.values()) {
      if (entryIds.size > 1) {
        for (const entryId of entryIds) {
          push(entryId, `"${name}" repeats elsewhere in this plan — saved anyway`)
        }
      }
    }
  }

  return warnings
}

function findFirstDuplicateFlavor(dishes: { flavors: string[] }[]): string | null {
  const seen = new Set<string>()
  for (const d of dishes) {
    for (const f of d.flavors) {
      if (seen.has(f)) return f
      seen.add(f)
    }
  }
  return null
}
```

**File:** `lib/planner/edit-warnings.test.ts` (create) — fixture-style cases, per `code-standards.md`'s testing convention for `lib/planner/*`:

1. No violations → empty map
2. One Lunch entry with two dishes sharing a flavor → warning naming the flavor
3. Same dish in two different-date entries of the same meal time → both entries flagged, no warning on unrelated entries
4. Breakfast entries never get a flavor-collision warning (only the repeat check applies to them)

### Step 3: Extend `getCurrentPlan` with flavors + computed warnings

**File:** `app/actions/plan.ts` (modify)

Add `flavors` to the dish include, and attach `entryWarnings` after the fetch:

```typescript
import { computeEntryWarnings, type WarningEntry } from "@/lib/planner/edit-warnings"

export async function getCurrentPlan() {
  const userId = await getUserId()

  const plan = await prisma.mealPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      entries: {
        include: {
          dishes: {
            include: {
              dish: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  isSpecial: true,
                  flavors: { select: { flavor: { select: { name: true } } } },
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: [{ date: "asc" }, { mealTime: "asc" }],
      },
      shoppingItems: {
        include: { ingredient: { select: { id: true, name: true } } },
      },
    },
  })

  if (!plan) return null

  const warningInput: WarningEntry[] = plan.entries.map((entry) => ({
    entryId: entry.id,
    mealTime: entry.mealTime,
    dishes: entry.dishes.map((d) => ({
      dishId: d.dish.id,
      dishName: d.dish.name,
      flavors: d.dish.flavors.map((f) => f.flavor.name),
    })),
  }))
  const warningsByEntry = computeEntryWarnings(warningInput)

  return {
    ...plan,
    entries: plan.entries.map((entry) => ({
      ...entry,
      entryWarnings: warningsByEntry.get(entry.id) ?? [],
    })),
  }
}
```

`dish.flavors` is fetched only to feed this computation — it is not read anywhere else, so no client component needs it and it doesn't need to be threaded through `PlanViewProps`.

### Step 4: Swap dish Server Action (transactional — also resyncs the shopping list)

**File:** `lib/zod/plan.ts` (modify — additive)

```typescript
export const SwapDishSchema = z.object({
  entryDishId: z.string().min(1),
  newDishId: z.string().min(1),
})
```

**File:** `lib/utils/shopping-list-diff.ts` (create) — pure, testable diffing logic, kept out of the Server Action so it has no DB dependency:

```typescript
export interface ExistingShoppingItem {
  id: string
  ingredientId: string
}

export interface ShoppingListDiff {
  toCreateIngredientIds: string[]
  toDeleteItemIds: string[]
}

/**
 * Given the full set of ingredients required by the plan's *current* dishes
 * and the shopping list rows that already exist, returns what to create and
 * what to delete. Ingredients present in both sets are left alone —
 * whatever `isChecked` state they carry is untouched.
 */
export function diffShoppingList(
  requiredIngredientIds: Set<string>,
  existingItems: ExistingShoppingItem[],
): ShoppingListDiff {
  const existingIngredientIds = new Set(existingItems.map((i) => i.ingredientId))

  const toCreateIngredientIds = [...requiredIngredientIds].filter(
    (id) => !existingIngredientIds.has(id),
  )
  const toDeleteItemIds = existingItems
    .filter((i) => !requiredIngredientIds.has(i.ingredientId))
    .map((i) => i.id)

  return { toCreateIngredientIds, toDeleteItemIds }
}
```

**File:** `lib/utils/shopping-list-diff.test.ts` (create) — fixture cases:

1. New ingredient required, nothing existing → `toCreate` has it, `toDelete` empty
2. Existing ingredient no longer required → `toDelete` has it, `toCreate` empty
3. Ingredient required by two dishes, one swapped away → still required by the other → neither list mentions it
4. No change → both lists empty

**File:** `app/actions/plan.ts` (modify — add two actions)

```typescript
import { SwapDishSchema } from "@/lib/zod/plan"
import { diffShoppingList } from "@/lib/utils/shopping-list-diff"

export async function getSwappableDishes(mealTime: "Breakfast" | "Lunch") {
  try {
    const userId = await getUserId()
    const dishes = await prisma.dish.findMany({
      where: { userId, isArchived: false, mealTime },
      select: { id: true, name: true, isSpecial: true },
      orderBy: { name: "asc" },
    })
    return { success: true as const, data: { dishes } }
  } catch {
    return { success: false as const, error: "Failed to fetch dishes" }
  }
}

export async function swapDishAction(input: { entryDishId: string; newDishId: string }) {
  try {
    const userId = await getUserId()

    const parsed = SwapDishSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false as const, error: "Invalid swap request" }
    }

    const entryDish = await prisma.mealPlanEntryDish.findFirst({
      where: { id: parsed.data.entryDishId, entry: { mealPlan: { userId } } },
      include: { entry: { include: { dishes: true } } },
    })
    if (!entryDish) {
      return { success: false as const, error: "Slot not found" }
    }

    const newDish = await prisma.dish.findFirst({
      where: { id: parsed.data.newDishId, userId, isArchived: false },
    })
    if (!newDish) {
      return { success: false as const, error: "Dish not found" }
    }
    if (newDish.mealTime !== entryDish.entry.mealTime) {
      return { success: false as const, error: "Dish must match this slot's meal time" }
    }

    const alreadyInEntry = entryDish.entry.dishes.some(
      (d) => d.id !== entryDish.id && d.dishId === newDish.id,
    )
    if (alreadyInEntry) {
      return { success: false as const, error: "That dish is already in this meal" }
    }

    const mealPlanId = entryDish.entry.mealPlanId

    await prisma.$transaction(async (tx) => {
      // 1. Perform the swap
      await tx.mealPlanEntryDish.update({
        where: { id: entryDish.id },
        data: { dishId: newDish.id },
      })

      // 2. Recompute required ingredients across the WHOLE plan, post-swap —
      //    not just old-dish-vs-new-dish, so ingredients shared with other
      //    dishes in the plan are never wrongly dropped.
      const allEntryDishes = await tx.mealPlanEntryDish.findMany({
        where: { entry: { mealPlanId } },
        select: { dishId: true },
      })
      const currentDishIds = [...new Set(allEntryDishes.map((d) => d.dishId))]

      const dishesWithIngredients = await tx.dish.findMany({
        where: { id: { in: currentDishIds } },
        select: { ingredients: { select: { ingredientId: true } } },
      })
      const requiredIngredientIds = new Set(
        dishesWithIngredients.flatMap((d) => d.ingredients.map((i) => i.ingredientId)),
      )

      // 3. Diff against what's already on the shopping list
      const existingItems = await tx.shoppingListItem.findMany({
        where: { mealPlanId },
        select: { id: true, ingredientId: true },
      })
      const { toCreateIngredientIds, toDeleteItemIds } = diffShoppingList(
        requiredIngredientIds,
        existingItems,
      )

      if (toDeleteItemIds.length > 0) {
        await tx.shoppingListItem.deleteMany({
          where: { id: { in: toDeleteItemIds } },
        })
      }
      if (toCreateIngredientIds.length > 0) {
        // Every newly-required ingredient can only have become required
        // because of newDish — safe to attribute the snapshot to it.
        await tx.shoppingListItem.createMany({
          data: toCreateIngredientIds.map((ingredientId) => ({
            mealPlanId,
            ingredientId,
            isChecked: false,
            dishName: newDish.name,
          })),
        })
      }
    })

    return { success: true as const, data: { entryDishId: entryDish.id } }
  } catch {
    return { success: false as const, error: "Failed to swap dish" }
  }
}
```

### Step 5: Shopping list Server Actions

**File:** `lib/zod/shopping-list.ts` (create)

```typescript
import { z } from "zod"

export const ToggleShoppingItemSchema = z.object({
  itemId: z.string().min(1),
  isChecked: z.boolean(),
})
```

**File:** `app/actions/shopping-list.ts` (create)

```typescript
"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ToggleShoppingItemSchema } from "@/lib/zod/shopping-list"

async function getUserId() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

export async function getCurrentShoppingList() {
  const userId = await getUserId()

  return prisma.mealPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shoppingItems: {
        select: { id: true, isChecked: true, ingredient: { select: { id: true, name: true } } },
        orderBy: { ingredient: { name: "asc" } },
      },
    },
  })
}

export async function toggleShoppingItemAction(input: { itemId: string; isChecked: boolean }) {
  try {
    const userId = await getUserId()

    const parsed = ToggleShoppingItemSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false as const, error: "Invalid input" }
    }

    const item = await prisma.shoppingListItem.findFirst({
      where: { id: parsed.data.itemId, mealPlan: { userId } },
    })
    if (!item) {
      return { success: false as const, error: "Item not found" }
    }

    await prisma.shoppingListItem.update({
      where: { id: parsed.data.itemId },
      data: { isChecked: parsed.data.isChecked },
    })

    return { success: true as const, data: { itemId: parsed.data.itemId } }
  } catch {
    return { success: false as const, error: "Failed to update item" }
  }
}
```

### ✅ Verify 6A Before Moving to 6B/6C

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` / `pnpm run build` | Pass |
| 2 | `npx vitest run` | Passes, including new `edit-warnings.test.ts` and `shopping-list-diff.test.ts`, after the `rules.ts` signature widen |
| 3 | `swapDishAction` rejects cross-meal-time swap | Call with a Breakfast `entryDishId` and a Lunch `newDishId` — expect `success: false` |
| 4 | `swapDishAction` rejects archived dish | Archive a dish, attempt to swap it in — expect `success: false` |
| 5 | `swapDishAction` rejects duplicate-in-entry | Attempt to swap a lunch slot to a dish already present in the other slot of that same entry — expect `success: false` |
| 6 | `swapDishAction` scopes to owner | Attempt a swap using another user's `entryDishId` — expect "Slot not found" |
| 7 | Flavor-collision warning appears | Swap a lunch dish so two dishes in one entry share a flavor — `getCurrentPlan()`'s returned entry has a non-empty `entryWarnings` naming the flavor |
| 8 | Repeat warning appears on both entries | Swap a dish so it now matches another entry of the same meal time — both entries' `entryWarnings` mention the repeat, not just one |
| 9 | Warnings self-heal | Swap the offending dish back / to something else — `entryWarnings` for that entry returns to empty on the next `getCurrentPlan()` call |
| 10 | `toggleShoppingItemAction` scopes to owner | Attempt to toggle another user's `itemId` — expect "Item not found" |
| 11 | Swap removes an orphaned ingredient | Swap away a dish whose ingredient is used nowhere else in the plan, **check that item first** — after swap, the row is gone from `getCurrentShoppingList()`, checked state and all |
| 12 | Swap adds a new ingredient | Swap in a dish with an ingredient not previously on the list — new unchecked row appears |
| 13 | Shared ingredient survives untouched | Two dishes in the plan share an ingredient; swap away one of them — the `ShoppingListItem` row survives with its prior `isChecked` value unchanged |
| 14 | Swap is atomic | Simulate a failure mid-transaction (e.g. temporarily throw inside the `tx` callback) — confirm neither the dish swap nor the shopping-list changes persisted (Prisma rolls back automatically) |

**Do not start 6B or 6C until all fourteen checks pass.**

---

## Phase 6B — Plan Editing UI

### Step 6: Fix the blocking-banner color bug (Dashboard only)

**File:** `app/(dashboard)/page.tsx` (modify)

Replace `border-warning bg-warning/5` → `border-destructive/40 bg-destructive/5`, and `text-warning` → `text-destructive`, at the Dashboard's blocking-banner usage site. No visual regression risk — these classes currently resolve to nothing. (The Plan view's occurrence of this same bug is removed outright in Step 10, not recolored — see below.)

### Step 7: Enable "Edit plan"

**File:** `components/plan-view.tsx` (modify)

```tsx
<Button variant="outline" size="sm" asChild>
  <Link href="/plan/edit">Edit plan</Link>
</Button>
```

Also thread `entryWarnings` through the existing `entriesByDate` grouping and into `<DayCard>` (new optional prop, see Step 9) — used only for the border tint + icon indicator now, not inline text (the full text lives in the Warnings Carousel, Step 10).

### Step 8: Edit Plan page

**File:** `app/(dashboard)/plan/edit/page.tsx` (create)

Server Component. Fetches `getCurrentPlan()` and both `getSwappableDishes("Breakfast")` / `getSwappableDishes("Lunch")` up front — the same two option lists apply to every Breakfast/Lunch slot respectively, so this avoids a per-pill fetch.

```tsx
const [plan, breakfastOptions, lunchOptions] = await Promise.all([
  getCurrentPlan(),
  getSwappableDishes("Breakfast"),
  getSwappableDishes("Lunch"),
])

if (!plan) redirect("/plan")

return (
  <EditPlanView
    plan={JSON.parse(JSON.stringify(plan))}
    breakfastOptions={breakfastOptions.success ? breakfastOptions.data.dishes : []}
    lunchOptions={lunchOptions.success ? lunchOptions.data.dishes : []}
  />
)
```

### Step 9: Day Card — additive edit props

**File:** `components/day-card.tsx` (modify — add `"use client"`, since edit mode now needs local popover/select state)

Extend each dish entry with `entryDishId: string` (needed by both view and edit mode, harmless to always include), and add two optional props:

```typescript
interface DayCardProps {
  date: Date
  breakfast: { dishId: string; entryDishId: string; dishName: string }[]
  lunch: {
    dishId: string
    entryDishId: string
    dishName: string
    sortOrder: number
    isSpecial: boolean
  }[]
  isSpecialDay: boolean
  warnings?: string[]
  editable?: boolean
  swappableDishes?: {
    Breakfast: { id: string; name: string; isSpecial: boolean }[]
    Lunch: { id: string; name: string; isSpecial: boolean }[]
  }
}
```

When `editable` is true, render `<EditableDishPill>` instead of `<DishPill>` for each dish. When `warnings?.length` is non-empty: apply `border-destructive/40` to the `Card` itself, and render a small `TriangleAlert` icon (no text) in the card header — the full warning sentence lives only in the `PlanWarningsCarousel` (Step 10), so it is deliberately **not** repeated here.

### Step 10: Warnings Carousel

Consolidates `MealPlan.warnings` (generation-time) and `entryWarnings`
(live, per-entry) into one deduplicated, swipeable list — replaces both the
old top banner and the old per-day-card text row.

**File:** `lib/utils/warning-cards.ts` (create)

```typescript
export interface WarningCard {
  id: string
  message: string
  scope: "generation" | "edit"
  dates: string[] // ISO calendar dates ("YYYY-MM-DD"), empty for generation-scope
}

interface EntryForWarnings {
  date: string // ISO calendar date
  entryWarnings: string[]
}

/**
 * Merges plan-level (generation-time) warnings and entry-level (live,
 * post-edit) warnings into one deduplicated list of display cards.
 * Entry-level warnings sharing identical message text (e.g. a repeat
 * flagged on both affected entries) collapse into a single card listing
 * every date it applies to.
 */
export function buildWarningCards(
  planWarnings: string[],
  entries: EntryForWarnings[],
): WarningCard[] {
  const cards: WarningCard[] = planWarnings.map((message, i) => ({
    id: `generation-${i}`,
    message,
    scope: "generation",
    dates: [],
  }))

  const byMessage = new Map<string, Set<string>>()
  for (const entry of entries) {
    for (const message of entry.entryWarnings) {
      const dates = byMessage.get(message) ?? new Set<string>()
      dates.add(entry.date)
      byMessage.set(message, dates)
    }
  }

  for (const [message, dates] of byMessage) {
    cards.push({
      id: `edit-${message}`,
      message,
      scope: "edit",
      dates: [...dates].sort(),
    })
  }

  return cards
}
```

**File:** `lib/utils/warning-cards.test.ts` (create) — fixture cases: no warnings → empty array; generation-only warnings pass through 1:1; a repeat message on two entries collapses into one card with two dates; generation + edit warnings both present → both appear, independently.

**Install:**

```bash
npx shadcn@latest add carousel
```

Installs `embla-carousel-react` + `components/ui/carousel.tsx`.

**⚠️ Radius gotcha:** shadcn's default `carousel.tsx` ships `CarouselPrevious` / `CarouselNext` as `Button` with a hardcoded `rounded-full` class. This project's `--radius: 0` rule (`code-standards.md`: never add a `rounded-*` utility class) means that file needs a one-line edit immediately after install — strip `rounded-full` from both button components in `components/ui/carousel.tsx`. Flagged, intentional divergence from the shadcn default — record it in `ui-context.md`.

**File:** `components/plan-warnings-carousel.tsx` (create, `"use client"`)

```tsx
"use client"

import { TriangleAlert } from "lucide-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { formatCalendarDate } from "@/lib/utils/date"
import type { WarningCard } from "@/lib/utils/warning-cards"

export function PlanWarningsCarousel({ warnings }: { warnings: WarningCard[] }) {
  if (warnings.length === 0) return null

  return (
    <Carousel className="relative mb-6 w-full" opts={{ align: "start" }}>
      <CarouselContent>
        {warnings.map((w) => (
          <CarouselItem key={w.id} className="basis-full sm:basis-2/3 md:basis-1/2">
            <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                <p>{w.message}</p>
                {w.dates.length > 0 && (
                  <p className="mt-1 text-xs opacity-80">
                    {w.dates
                      .map((d) =>
                        formatCalendarDate(new Date(d), { month: "short", day: "numeric" }),
                      )
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      {warnings.length > 1 && (
        <>
          <CarouselPrevious className="left-0" />
          <CarouselNext className="right-0" />
        </>
      )}
    </Carousel>
  )
}
```

Embla's default drag behavior already gives the "horizontal swipe" feel on touch/mobile with zero extra config. Nav arrows only render when there's more than one card.

**Wiring — `components/plan-view.tsx` (modify):** remove the old generation-warnings banner entirely, replace with:

```tsx
import { buildWarningCards } from "@/lib/utils/warning-cards"
import { PlanWarningsCarousel } from "@/components/plan-warnings-carousel"

const warningCards = buildWarningCards(
  plan.warnings as string[],
  plan.entries.map((e) => ({
    date: e.date.toISOString().slice(0, 10),
    entryWarnings: e.entryWarnings,
  })),
)

// render, above the day cards:
<PlanWarningsCarousel warnings={warningCards} />
```

`components/edit-plan-view.tsx` gets the same wiring (Step 13) — since a successful swap triggers `router.refresh()`, the carousel's contents update automatically on the next render.

### Step 11: Toast setup

**Install:**

```bash
npx shadcn@latest add sonner
```

**File:** `app/layout.tsx` (modify) — mount once, globally (not just the dashboard group, since Phase 7's account settings will also want it):

```tsx
import { Toaster } from "@/components/ui/sonner"

// inside the root layout's <body>, alongside <ThemeProvider>
<Toaster />
```

### Step 12: Editable Dish Pill

**File:** `components/editable-dish-pill.tsx` (create, `"use client"`)

Wraps the existing `<DishPill>`. Clicking the pencil icon swaps it for a `<Select>` (shadcn) populated with `options` **excluding** any dish already occupying another slot in the same entry, but always **including** the currently-assigned dish even if archived (so the Select never renders with an unlisted value — the "archived-dish edge case" decision above). On failure, shows a toast instead of silently reverting.

```tsx
"use client"

import { toast } from "sonner"

interface EditableDishPillProps {
  entryDishId: string
  dishId: string
  dishName: string
  isSpecial?: boolean
  options: { id: string; name: string; isSpecial: boolean }[]
  excludeIds: string[] // other dishes already in this entry
}

export function EditableDishPill({
  entryDishId,
  dishId,
  dishName,
  isSpecial,
  options,
  excludeIds,
}: EditableDishPillProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)

  const selectable = options
    .filter((o) => o.id === dishId || !excludeIds.includes(o.id))
    .concat(options.some((o) => o.id === dishId) ? [] : [{ id: dishId, name: dishName, isSpecial: !!isSpecial }])

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <DishPill name={dishName} isSpecial={isSpecial} />
        <button type="button" aria-label="Swap dish" onClick={() => setEditing(true)}>
          <Pencil className="size-3 text-muted-foreground" />
        </button>
      </span>
    )
  }

  return (
    <Select
      defaultValue={dishId}
      disabled={pending}
      onValueChange={async (newDishId) => {
        setPending(true)
        const result = await swapDishAction({ entryDishId, newDishId })
        setPending(false)
        setEditing(false)
        if (result.success) {
          router.refresh()
        } else {
          toast.error(result.error)
          // Select already closed back to the prior (still-correct, unsaved)
          // value — router.refresh() is skipped so nothing stale re-renders
        }
      }}
    >
      <SelectTrigger className="h-7 w-auto text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {selectable.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

`router.refresh()` re-fetches `getCurrentPlan()` server-side, so `entryWarnings` (Step 3) and the Warnings Carousel (Step 10) reflect the swap's outcome immediately — same pattern Phase 5 already established for generation.

### Step 13: Edit Plan View

**File:** `components/edit-plan-view.tsx` (create, `"use client"`)

Structurally the same entries-by-date / weeks grouping already written in `plan-view.tsx` (Step 7's `entriesByDate` logic is reused, not reinvented — extract it as a shared helper if duplication would otherwise exceed ~15 lines). Wires in the same `buildWarningCards` + `<PlanWarningsCarousel>` pattern from Step 10. Renders:

```
← Plan view

Edit plan

[Warnings carousel — if any]

[day cards, editable, each dish pill has an edit affordance]

                                                      [Done]
```

"Done" is a `<Link href="/plan">`. No form state, no submit handler — every swap already persisted itself.

### ✅ Verify 6B

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` / `pnpm run build` | Pass |
| 2 | "Edit plan" navigates | Click from `/plan` → lands on `/plan/edit` with the same plan's data |
| 3 | No current plan → redirect | Visiting `/plan/edit` with no plan sends you to `/plan` |
| 4 | Swap persists | Swap a dish, hard-refresh the browser tab (not just `router.refresh()`) — new dish is still there |
| 5 | Warning card appears and matches | Force a flavor collision via swap — the specific flavor name shows in a carousel card |
| 6 | Repeat collapses to one card | Force a repeat via swap — one carousel card lists both affected dates, not two separate cards |
| 7 | Duplicate-in-entry blocked client-side | The Select for one lunch slot never lists a dish already occupying the entry's other slot |
| 8 | Archived dish still renders | Archive a dish currently placed in a slot, revisit `/plan/edit` — that slot still shows the dish's name and can still be swapped away from |
| 9 | Meal-time isolation | Breakfast slots only ever offer Breakfast dishes, Lunch slots only Lunch dishes |
| 10 | Dashboard bug fixed | The Dashboard blocking banner now renders visible destructive-toned styling |
| 11 | Mobile responsive | Sidebar collapses, day cards stack |
| 12 | Swap failure shows a toast | Force `swapDishAction` to fail (e.g. temporarily throw, or pass a stale `entryDishId`) — a `toast.error` appears with the returned error message, Select closes back to the prior value |
| 13 | Carousel renders, swipeable | With 2+ warnings present (mix of generation + edit scope), the carousel shows nav arrows and swiping/dragging moves between cards |
| 14 | Single warning, no dead controls | With exactly one warning, the card renders with no prev/next arrows |
| 15 | Zero warnings → nothing renders | Clean plan with no violations shows no carousel at all, no empty shell |
| 16 | Day-card indicator only, no duplicate text | Affected day cards show the border tint + icon but never repeat the warning sentence itself |
| 17 | No `rounded-full` leakage | `components/ui/carousel.tsx`'s nav buttons render with sharp corners after the post-install edit |

---

## Phase 6C — Shopping List UI

### Step 14: Shopping List page

**File:** `app/(dashboard)/shopping-list/page.tsx` (create)

Server Component.

```tsx
const plan = await getCurrentShoppingList()

if (!plan) {
  return (
    <div>
      <h1 className="mb-2 text-lg font-semibold">Shopping list</h1>
      <p className="text-sm text-muted-foreground">
        No shopping list yet —{" "}
        <Link href="/plan" className="underline underline-offset-4">
          generate a plan
        </Link>{" "}
        to get one.
      </p>
    </div>
  )
}

return <ShoppingListView planId={plan.id} items={plan.shoppingItems} />
```

### Step 15: Shopping List View

**File:** `components/shopping-list-view.tsx` (create, `"use client"`)

```tsx
interface ShoppingListViewProps {
  planId: string
  items: { id: string; isChecked: boolean; ingredient: { id: string; name: string } }[]
}

export function ShoppingListView({ items: initialItems }: ShoppingListViewProps) {
  const [items, setItems] = useState(initialItems)
  const checkedCount = items.filter((i) => i.isChecked).length

  async function handleToggle(itemId: string, isChecked: boolean) {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, isChecked } : i)),
    )
    const result = await toggleShoppingItemAction({ itemId, isChecked })
    if (!result.success) {
      // revert on failure
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, isChecked: !isChecked } : i)),
      )
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Shopping list</h1>
        <span className="text-xs text-muted-foreground">
          {checkedCount} of {items.length} checked
        </span>
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 p-3 text-sm"
            >
              <Checkbox
                checked={item.isChecked}
                onCheckedChange={(checked) => handleToggle(item.id, checked === true)}
              />
              <span className={item.isChecked ? "text-muted-foreground line-through" : ""}>
                {item.ingredient.name}
              </span>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
```

Requires the shadcn `checkbox` component — install if not already present: `npx shadcn@latest add checkbox`.

**Recommended (not required):** add `toast.error(result.error)` right before the revert in `handleToggle`'s failure branch, for the same silent-failure reason as Step 12 — a failed check-off currently reverts with no explanation.

### ✅ Verify 6C

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` / `pnpm run build` | Pass |
| 2 | Empty state | Visiting `/shopping-list` with no plan shows the empty state + link to `/plan` |
| 3 | List renders | Ingredients from the current plan render, deduplicated (already guaranteed by the `[mealPlanId, ingredientId]` unique constraint from Phase 5) |
| 4 | Checked state persists | Check a few items, hard-refresh the browser tab — still checked |
| 5 | Counter updates live | "X of Y checked" updates immediately on toggle, no page reload |
| 6 | Optimistic revert works | Temporarily break `toggleShoppingItemAction` (e.g. wrong `itemId`) — row flips back and doesn't silently keep an unsaved checked state |
| 7 | Dashboard summary matches | The Dashboard's "Shopping list" card count matches what `/shopping-list` shows |
| 8 | Mobile responsive | Sidebar collapses, list remains usable |
| 9 | Reflects swaps from `/plan/edit` | Swap a dish on the edit screen, then visit `/shopping-list` — list matches the plan's current dishes, not the original generation |

---

## Files Summary

| File | Action | Sub-phase | Description |
|---|---|---|---|
| `lib/planner/rules.ts` | Modify | 6A | Widen `hasFlavorCollision` param type to `{ flavors: string[] }[]` |
| `lib/planner/edit-warnings.ts` | Create | 6A | `computeEntryWarnings` — pure, reused by view and edit |
| `lib/planner/edit-warnings.test.ts` | Create | 6A | Fixture tests for collision / repeat / self-heal cases |
| `lib/zod/plan.ts` | Modify | 6A | Add `SwapDishSchema` |
| `lib/zod/shopping-list.ts` | Create | 6A | `ToggleShoppingItemSchema` |
| `lib/utils/shopping-list-diff.ts` | Create | 6A | Pure diff logic for shopping-list sync on swap |
| `lib/utils/shopping-list-diff.test.ts` | Create | 6A | Fixture tests |
| `app/actions/plan.ts` | Modify | 6A | `getCurrentPlan` extended with flavors + `entryWarnings`; add `getSwappableDishes`, `swapDishAction` (now a transaction syncing `ShoppingListItem`) |
| `app/actions/shopping-list.ts` | Create | 6A | `getCurrentShoppingList`, `toggleShoppingItemAction` |
| `app/(dashboard)/page.tsx` | Modify | 6B | Fix `border-warning`/`text-warning` → destructive tokens (Dashboard's own blocking banner only) |
| `lib/utils/warning-cards.ts` | Create | 6B | `buildWarningCards` — merges + dedupes generation and edit warnings |
| `lib/utils/warning-cards.test.ts` | Create | 6B | Fixture tests |
| `components/plan-warnings-carousel.tsx` | Create | 6B | Swipeable, deduplicated warning display |
| shadcn: `carousel` | Install | 6B | Requires a post-install edit to strip `rounded-full` |
| shadcn: `sonner` | Install | 6B | Toast for swap failures |
| `app/layout.tsx` | Modify | 6B | Mount `<Toaster />` globally |
| `components/plan-view.tsx` | Modify | 6B | Remove old banner; wire in `PlanWarningsCarousel`; enable "Edit plan" link; thread `entryWarnings` |
| `components/day-card.tsx` | Modify | 6B | `"use client"`; add `entryDishId`, `warnings`, `editable`, `swappableDishes` props; border tint + icon only, no inline text |
| `components/editable-dish-pill.tsx` | Create | 6B | Pencil-to-Select swap affordance; `toast.error()` on failure |
| `app/(dashboard)/plan/edit/page.tsx` | Create | 6B | Edit page: fetches plan + both option lists, redirects if no plan |
| `components/edit-plan-view.tsx` | Create | 6B | Edit screen: warnings carousel + day cards (editable) + "Done" |
| `app/(dashboard)/shopping-list/page.tsx` | Create | 6C | Shopping list page: empty state or `ShoppingListView` |
| `components/shopping-list-view.tsx` | Create | 6C | Checklist with optimistic toggle + live counter; recommended `toast.error` on failure |
| shadcn: `checkbox` | Install | 6C | Used by `ShoppingListView` |
| `.agents/context/ui-context.md` | Update | — | Record the destructive-token-for-warnings decision and the carousel radius-strip decision |
| `.agents/context/features/06-plan-editing-and-shopping-list.md` | Update | — | This plan document |
| `.agents/context/progress-tracker.md` | Update | — | Mark Phase 6 complete |

---

## Key Constraints

- `lib/planner/*` stays pure — `edit-warnings.ts` has zero imports from `next` or `@prisma/client`; only an additive, backward-compatible type widen on `rules.ts`
- `lib/utils/shopping-list-diff.ts` and `lib/utils/warning-cards.ts` are also pure, framework-free, and independently unit-tested — kept out of the Server Actions and components that use them
- All new Server Actions scope to `session.user.id`; every one returns `{ success: true, data } | { success: false, error }`
- `swapDishAction` is a **transaction** spanning `MealPlanEntryDish` and `ShoppingListItem` — a dish swap and its shopping-list resync commit together or not at all. Ingredients still required by any other dish in the plan keep their `isChecked` state; only ingredients no longer required anywhere in the plan are deleted (even if previously checked).
- Edit never changes plan shape (slot count, special-day structure) — only which dish occupies an existing slot
- Dish deletion stays soft; an archived dish already placed in a plan must keep resolving and stay selectable-as-current in its own slot's Select
- Entry-level warnings are computed live on every `getCurrentPlan()` call, never persisted — they self-heal the moment the underlying violation is edited away
- Generation-time and edit-time warnings are merged and deduplicated by message text into one `PlanWarningsCarousel` — never rendered as two separate banner types
- No `rounded-*` Tailwind classes; no hardcoded hex colors; the `destructive` token (not a new `warning` token) is the canonical styling for non-blocking rule-violation content project-wide — including the shadcn carousel's default nav buttons, which ship `rounded-full` and must be stripped post-install

---

## Overall Verification Checklist

1. `pnpm run typecheck` — zero errors
2. `pnpm run build` — passes
3. `npx vitest run` — all planner + utils tests pass, including `edit-warnings.test.ts`, `shopping-list-diff.test.ts`, and `warning-cards.test.ts`
4. Swapping a dish persists across a hard refresh, never deletes or restructures the plan
5. Swapping a dish keeps the shopping list in sync: orphaned ingredients are removed (even if checked), newly-required ingredients are added unchecked, ingredients shared with other dishes are left untouched
6. Flavor-collision and repeat violations from an edit are visible (via the Warnings Carousel), named specifically, and never block the save
7. Violation warnings disappear on their own once the underlying dish is swapped again (no stale persisted state)
8. An archived dish already placed in a plan still renders and remains swappable
9. A failed swap surfaces a toast error and never silently no-ops
10. Shopping list is deduplicated (inherited from Phase 5's unique constraint), checkable, and checked state survives a hard refresh
11. Dashboard's shopping-list summary count matches the `/shopping-list` screen
12. The `border-warning`/`text-warning`/`bg-warning` bug is fixed on the Dashboard; the Plan view's occurrence is moot since that banner is replaced by the carousel
13. The Warnings Carousel dedupes identical messages across entries, is swipeable with 2+ items, and renders nothing when there are no warnings
14. Mobile responsive on both new screens, including carousel swipe gestures