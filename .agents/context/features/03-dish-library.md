# Phase 3: Dish Library

## Overview

Build a complete dish management system with full CRUD operations, ingredient
management via a sheet drawer, category/meal-time filtering, and a card grid
layout. This is the foundation for meal plan generation.

> **Revision note:** this replaces the earlier draft of this plan. Four
> implementation decisions were resolved before continuing — the
> `deleteIngredient` guard scope, case-insensitive dedup for ingredients and
> flavors, the Special-dish/Breakfast conflict, and a consistent Server Action
> return shape — see **Design Decisions** below. The phase is also split into
> three independently-verifiable units (3A / 3B / 3C), per
> `ai-workflow-rules.md`'s rule that a Server Action and the UI consuming it
> are separate steps, and that a component shouldn't be built before its
> dependency is verified.

## Goals

- Users can create, view, edit, and soft-delete dishes
- Users can manage ingredients via a slide-out sheet drawer
- Users can filter dishes by category and meal time
- Users can search dishes by name
- UI follows existing design system (shadcn/ui, Tailwind, no rounded corners)

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| `deleteIngredient` guard scope | Block delete only if the ingredient is referenced by a **non-archived** `Dish` via `DishIngredient`. Archived-dish references and any `ShoppingListItem` rows in past plans do **not** block deletion. | If no currently-active dish uses an ingredient, there's no reason to keep buying it — including retroactively, on past shopping lists. |
| Ingredient deletion cascade | Deleting an `Ingredient` cascades (`onDelete: Cascade`, already in the Phase 1 schema) through `DishIngredient` rows on archived dishes and through `ShoppingListItem` rows on past plans. **This is intended, not a bug.** | Direct consequence of the guard above. **Doc-sync flag:** this is a narrow, explicit exception to `architecture.md` Invariant 3 ("a plan's shopping list... must never be retroactively changed") — that invariant was written with *dish* edits/archiving in mind, not explicit ingredient deletion. Worth a one-line addition to Invariant 3 the next time `architecture.md` is touched, so the exception is documented rather than implicit. |
| Ingredient name uniqueness | **Case-insensitive.** `createIngredient` runs a `mode: "insensitive"` existence check before creating; on a match it returns the existing row (`reused: true`) instead of erroring or duplicating. `updateIngredient` runs the same check (excluding itself) and **blocks** the rename if it collides with a *different* ingredient. | The DB's `@@unique([name, userId])` is case-sensitive and won't catch `"Rice"` vs. `"rice"` — silently defeats the dedup guarantee the whole ingredient-master-list design exists for. Returning the existing row (instead of an error) keeps the inline search-or-create combobox flow frictionless. |
| Flavor uniqueness (per dish) | `createDish` / `updateDish` dedupe the incoming `flavors` array case-insensitively before persisting (keep first-seen casing), then enforce the 10-flavor cap on the **deduped** result. | Same DB limitation as above, scoped to `@@unique([dishId, flavor])`. Flagging forward: Phase 4's flavor-uniqueness rule in `lib/planner` will also need case-insensitive comparison across dishes — not resolved here, since it's outside this phase's boundary. |
| Special + Meal Time | `isSpecial` cannot be `true` when `mealTime` is `"Breakfast"` — enforced at **both** layers: a Zod `.refine` on `DishSchema` (server boundary, can't be bypassed by a direct action call) **and** the dish form UI, which disables and unchecks the Special toggle whenever Meal Time = Breakfast. | `project-overview.md` only ever describes Special Day applying to a *lunch* slot. UI-only disabling isn't enough per `code-standards.md` ("validate unknown input... at the boundary"). |
| Server Action return shape | Every action in `dishes.ts` and `ingredients.ts` returns `{ success: true, data } \| { success: false, error: string }`, exactly per `code-standards.md`. No bare `{ dish }` / `{ dishes }` returns. | Resolves an inconsistency in the original draft between its action table and its own stated standard. |

---

## Database Schema (Already Defined)

The Prisma schema already defines:

| Model | Key Fields | Notes |
|-------|------------|-------|
| **Dish** | id, name, category, mealTime, isSpecial, isArchived, userId | isArchived = soft-delete |
| **Flavor** | id, name, userId | Shared flavor registry per user; unique on [name, userId] |
| **DishFlavor** | id, dishId, flavorId | Junction table linking Dish to Flavor; unique per dish |
| **DishIngredient** | id, dishId, ingredientId | Links dish to ingredient |
| **Ingredient** | id, name, userId | Unique per user+name (case-sensitive at DB level — see Design Decisions) |

**Enums:**
- `Category`: MAIN, SIDE, SOUP, SNACK, ACCOMPANIMENTS, OTHER
- `MealTime`: Breakfast, Lunch

---

## Execution Order

This phase is **three** separable units, not one — `ai-workflow-rules.md`
requires verifying a Server Action before the UI that calls it, and the
ingredient combobox is itself a dependency of the dish form, not a peer of
it. Build and verify in this order:

- **3A — Data layer**: Zod schemas + Server Actions for both dishes and
  ingredients. No UI yet. Verify directly (typecheck/build + a throwaway
  smoke check) before writing a single component.
- **3B — Ingredient management UI**: the ingredient sheet and combobox.
  Depends only on 3A. Verify it end-to-end on its own — even though its
  natural host (the dish dialog) doesn't exist yet — before building
  anything that depends on it.
- **3C — Dish CRUD UI**: dish cards, the dish dialog (which *consumes* the
  3B combobox), delete confirmation, the library page with filters/search.
  Depends on 3A and 3B both being verified first.

---

## Phase 3A — Data Layer

### File Structure

```
lib/
  zod/
    dish.ts                         # Dish validation schemas
    ingredient.ts                   # Ingredient validation schemas

app/actions/
  dishes.ts                         # Dish server actions (CRUD)
  ingredients.ts                    # Ingredient server actions (CRUD)
```

### Step 1: Zod Validation Schemas

#### `lib/zod/dish.ts`

**DishSchema** — for create/edit form:
- `name`: string, trimmed, 2–100 chars
- `category`: enum (MAIN | SIDE | SOUP | SNACK | ACCOMPANIMENTS | OTHER)
- `mealTime`: enum (Breakfast | Lunch)
- `isSpecial`: boolean, default false
- `flavors`: array of strings (1–50 chars each), max 10, default []
- `ingredientIds`: array of strings (cuid), max 20, default []

Plus a refinement enforcing the Special/Breakfast rule at the boundary:

```ts
export const DishSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.nativeEnum(Category),
  mealTime: z.nativeEnum(MealTime),
  isSpecial: z.boolean().default(false),
  flavors: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
  ingredientIds: z.array(z.string().cuid()).max(20).default([]),
}).refine(
  (data) => !(data.mealTime === "Breakfast" && data.isSpecial),
  { message: "Special dish flag only applies to Lunch", path: ["isSpecial"] }
)
```

**DishFilterSchema** — for list filtering:
- `category`: optional enum
- `mealTime`: optional enum
- `search`: optional string, trimmed, max 100 chars
- `page`: optional integer ≥ 1, defaults to 1
- `pageSize`: optional integer 1–100, defaults to 12

#### `lib/zod/ingredient.ts`

**IngredientSchema** — for create/edit:
- `name`: string, trimmed, 2–100 chars

(The case-insensitive duplicate check itself is a DB read, not a sync Zod
rule — it lives in the Server Action, Step 2 below.)

### Step 2: Server Actions

### `app/actions/dishes.ts`

| Action | Description | Returns |
|--------|-------------|---------|
| `getDishes(filters?)` | List non-archived dishes for user with optional category/mealTime/search filters and page-based pagination (`page`, `pageSize`; defaults: page=1, pageSize=12) | `{ success: true, data: { dishes: DishWithRelations[], total: number, page: number, pageSize: number, totalPages: number } } \| { success: false, error: string }` |
| `getDishById(dishId)` | Get single dish with relations, scoped to `session.user.id` | `{ success: true, data: { dish: DishWithRelations } } \| { success: false, error }` |
| `createDish(data)` | Validate with `DishSchema`; dedupe `flavors` case-insensitively before persisting; nested-create flavors + ingredient links | `{ success: true, data: { dish: DishWithRelations } } \| { success: false, error }` |
| `updateDish(dishId, data)` | Same validation + dedupe; replace flavors (delete-then-create) and ingredient links (disconnect/reconnect) | `{ success: true, data: { dish: DishWithRelations } } \| { success: false, error }` |
| `deleteDish(dishId)` | Soft-delete: set `isArchived = true`. Never a hard delete. | `{ success: true, data: { dishId: string } } \| { success: false, error }` |

**Type: DishWithRelations**
```typescript
{
  id: string
  name: string
  category: Category
  mealTime: MealTime
  isSpecial: boolean
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  flavors: { id: string; flavor: { id: string; name: string } }[]
  ingredients: { id: string; ingredient: { id: string; name: string } }[]
}
```

**Key behaviors:**
- All queries filter by `userId` from `getServerSession(authOptions)` — no
  exceptions (`architecture.md`, Auth and Access Model)
- `createDish`/`updateDish`: case-insensitive flavor dedupe happens *after*
  Zod parsing, *before* the Prisma write — keep first-seen casing, then
  re-check the 10-item cap against the deduped array. Each flavor is
  upserted into the `Flavor` registry (find-or-create by name + userId),
  then linked via `DishFlavor` junction row
- `deleteDish` only ever sets `isArchived = true`
- Every action returns the standardized `{ success, data } | { success, error }`
  shape — never let a raw Prisma error reach the client

### `app/actions/ingredients.ts`

| Action | Description | Returns |
|--------|-------------|---------|
| `getIngredients(search?)` | List user's ingredients, optional case-insensitive contains-filter | `{ success: true, data: { ingredients: Ingredient[] } } \| { success: false, error }` |
| `createIngredient(data)` | Case-insensitive existence check first. Match → return existing row. No match → create. | `{ success: true, data: { ingredient: Ingredient; reused: boolean } } \| { success: false, error }` |
| `updateIngredient(ingredientId, data)` | Case-insensitive existence check (excluding self). Collides with a *different* ingredient → block. Otherwise rename. | `{ success: true, data: { ingredient: Ingredient } } \| { success: false, error }` |
| `deleteIngredient(ingredientId)` | Block if referenced by `DishIngredient` on any **non-archived** dish. Otherwise delete — cascades through archived-dish links and `ShoppingListItem` rows by design (see Design Decisions). | `{ success: true, data: { ingredientId: string } } \| { success: false, error }` |

**Key implementation detail — `createIngredient`:**

```ts
const existing = await prisma.ingredient.findFirst({
  where: { userId, name: { equals: parsed.data.name, mode: "insensitive" } },
})
if (existing) {
  return { success: true as const, data: { ingredient: existing, reused: true } }
}
const ingredient = await prisma.ingredient.create({
  data: { name: parsed.data.name, userId },
})
return { success: true as const, data: { ingredient, reused: false } }
```

**Key implementation detail — `deleteIngredient`:**

```ts
const usedByActiveDish = await prisma.dishIngredient.findFirst({
  where: { ingredientId, dish: { userId, isArchived: false } },
})
if (usedByActiveDish) {
  return { success: false as const, error: "Ingredient is used by an active dish" }
}
await prisma.ingredient.delete({ where: { id: ingredientId } })
// Cascades through DishIngredient (archived dishes) and ShoppingListItem
// (past plans) automatically — intended, see Design Decisions.
return { success: true as const, data: { ingredientId } }
```

**Key behaviors:**
- All queries filter by `userId`
- `createIngredient` never throws on a duplicate name — it reuses
- `updateIngredient` is the only action that can still hit the DB's
  case-sensitive unique constraint as a last-resort safety net (race
  condition between the check and the write); catch `P2002` the same way
  `app/actions/auth.ts`'s `signup` does, and map it to the same "already
  exists" error

### ✅ Verify 3A Before Moving to 3B

There's no UI yet, so "verify end-to-end" means confirming the actions work
correctly against the real DB before anything is built on top of them:

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` | Passes |
| 2 | `pnpm run build` | Passes |
| 3 | Case-insensitive ingredient reuse | Call `createIngredient({ name: "Rice" })` then `createIngredient({ name: "rice" })` directly (Vitest or a scratch script) — second call returns `reused: true` with the same `ingredient.id`, no duplicate row created |
| 4 | Ingredient rename collision | Create "Tomato" and "Onion", attempt to rename "Onion" → "tomato" — blocked with an error, not a `P2002` leak |
| 5 | Ingredient delete guard | Create a dish using an ingredient, attempt `deleteIngredient` — blocked. Archive that dish (or use an unused ingredient) — delete succeeds |
| 6 | Flavor dedupe | Call `createDish` with `flavors: ["Spicy", "spicy", "Sweet"]` — persisted dish has exactly 2 `DishFlavor` rows; only 2 `Flavor` registry rows created (Spicy + Sweet) |
| 7 | Special + Breakfast refusal | Call `createDish` with `mealTime: "Breakfast", isSpecial: true` directly — rejected by the Zod refine before any DB call |

**Do not start 3B until all seven checks pass.**

---

## Phase 3B — Ingredient Management UI

### File Structure

```
components/
  ingredient-sheet.tsx              # Ingredient management sheet drawer
  ingredient-combobox.tsx           # Ingredient multi-select for dish form

components/ui/                      # shadcn components to install this step
  sheet.tsx
  command.tsx
  popover.tsx
```

### Step 3: Install shadcn Components

```bash
npx shadcn@latest add sheet command popover
```

### Step 4: Ingredient Sheet Drawer — `components/ingredient-sheet.tsx`

Slide-out sheet from the right for managing ingredients.

**Layout:**
```
┌──────────────────────────────────────┐
│ Manage Ingredients              [X] │
├──────────────────────────────────────┤
│ [+ Add ingredient...        ] [Add] │
├──────────────────────────────────────┤
│ Rice                         [X]    │  ← click to edit
│ Chicken breast               [X]    │
│ Garlic                       [X]    │
│ Onion                        [X]    │
│ Soy sauce                    [X]    │
│                                      │
│ (scrollable list)                    │
└──────────────────────────────────────┘
```

**Behaviors:**
1. **Add**: Type name in input + press Enter or click Add → calls
   `createIngredient`. If `reused: true` comes back, surface a quiet inline
   note ("Already in your list") instead of an error — it's not a failure.
   Input clears either way.
2. **Edit**: Click ingredient name → transforms to inline input → Enter
   calls `updateIngredient`. On the "name already exists" error, show it
   inline and keep the field open for correction rather than silently
   reverting. Escape cancels without saving.
3. **Delete**: Click `X` → small `AlertDialog` confirmation → confirm calls
   `deleteIngredient`. On the "used by an active dish" error, surface it in
   the confirmation dialog itself (don't let it fail silently after confirm).
4. **Empty state**: "No ingredients yet. Add your first ingredient above."

**Props:**
```typescript
interface IngredientSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange?: () => void  // called after any add/rename/delete, so a host
                          // component (e.g. the combobox) can refetch
}
```

**Width**: ~400px on desktop, full-width on mobile (shadcn sheet defaults).
Double-check it doesn't pick up rounded corners from the default shadcn
`Sheet` — `issues-history.md` already caught this once on a different
component; `--radius: 0` must apply here too.

### Step 5: Ingredient Combobox — `components/ingredient-combobox.tsx`

Searchable multi-select for choosing ingredients in the dish form.

**Layout:**
```
┌──────────────────────────────────────────────┐
│ [Rice ×] [Chicken ×]  [Search ingredients… ▼] │
└──────────────────────────────────────────────┘
  └──────────────────────────────────────────
  │ Garlic                                    │
  │ Onion                                     │
  │ Soy sauce                                 │
  │ ──────────────────────                    │
  │ ⚙ Manage Ingredients                      │  ← opens the sheet
  └────────────────────────────────────────────┘
```

**Behaviors:**
1. Typing searches the user's ingredients (case-insensitive contains match,
   via `getIngredients(search)`)
2. Selecting adds a chip; clicking `×` on a chip removes the selection
3. "Manage Ingredients" opens `IngredientSheet`
4. The combobox passes its own refetch as the sheet's `onChange`, so
   add/rename/delete in the sheet is immediately reflected in the dropdown
   the moment the sheet closes — no manual "did it sync" step

**Props:**
```typescript
interface IngredientComboboxProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}
```

### ✅ Verify 3B Before Moving to 3C

The combobox's natural host (the dish dialog) doesn't exist yet, so verify
both components directly:

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` / `pnpm run build` | Pass |
| 2 | Sheet stand-alone | Temporarily mount `<IngredientSheet open onOpenChange={...} />` on the `/dishes` placeholder page (or any scratch route) — confirm add, inline-rename, and delete-with-guard all work against the real DB |
| 3 | Sheet → combobox sync | Mount the combobox alongside the sheet trigger in the same scratch harness — add an ingredient via the sheet, close it, confirm the combobox's dropdown shows it without a page refresh |
| 4 | No unwanted rounding | Visually confirm the Sheet, Popover, and Command list all render with sharp corners |
| 5 | Remove the scratch mount | Don't leave a dev-only route behind once 3C wires these in for real |

---

## Phase 3C — Dish CRUD UI

### File Structure

```
app/(dashboard)/dishes/
  page.tsx                          # Server component wrapper
  dish-library.tsx                  # Client component - main library UI
  loading.tsx                       # Loading skeleton

components/
  dish-dialog.tsx                   # Create/Edit dish dialog
  dish-card.tsx                     # Individual dish card
  delete-dish-dialog.tsx            # Delete confirmation dialog
  category-badge.tsx                # Category badge component
  flavor-tag.tsx                    # Flavor chip/tag

components/ui/                      # shadcn components to install this step
  badge.tsx
  select.tsx
  dialog.tsx
  alert-dialog.tsx
```

### Step 6: Install Remaining shadcn Components

```bash
npx shadcn@latest add badge select dialog alert-dialog
```

### Step 7: Display Components

#### `components/category-badge.tsx`

| Category | Label |
|----------|-------|
| MAIN | Main |
| SIDE | Side |
| SOUP | Soup |
| SNACK | Snack |
| ACCOMPANIMENTS | Accompaniments |
| OTHER | Other |

Uses shadcn `Badge` with a variant prop for subtle color differentiation.

#### `components/flavor-tag.tsx`

Small chip displaying a flavor name. Used on dish cards and in the dish form.

#### `components/dish-card.tsx`

```
┌─────────────────────────────────┐
│ [Main]                   [★]   │  ← category badge + special indicator
│                                 │
│ Dish Name                       │  ← bold, truncated if long
│                                 │
│ Breakfast · 3 ingredients       │  ← meal time + ingredient count
│                                 │
│ [spicy] [umami]                 │  ← flavor tags (max 3 shown, +N more)
│                                 │
│ [Edit]  [Delete]                │  ← action buttons
└─────────────────────────────────┘
```

Note: the `[★]` indicator only ever appears for Lunch dishes (`isSpecial`
can't be `true` on a Breakfast dish — see Design Decisions).

**Props:**
- `dish: DishWithRelations`
- `onEdit: (dish) => void`
- `onDelete: (dish) => void`

### Step 8: Dish Form Dialog — `components/dish-dialog.tsx`

```
┌─────────────────────────────────────────┐
│ Create Dish                        [X]  │
├─────────────────────────────────────────┤
│                                         │
│ Dish name                               │
│ [____________________________]          │
│                                         │
│ Category        Meal Time               │
│ [MAIN       ▼]  (•) Breakfast           │
│                  ( ) Lunch               │
│                                         │
│ [☐] Special dish   ← disabled when Meal Time = Breakfast │
│                                         │
│ Flavors                                 │
│ [spicy ×] [umami ×]  [Add flavor...]   │
│                                         │
│ Ingredients                             │
│ [Rice ×] [Chicken ×]  [Search...    ▼] │
│ [⚙ Manage Ingredients]                  │
│                                         │
├─────────────────────────────────────────┤
│ [Cancel]                    [Save]      │
└─────────────────────────────────────────┘
```

**Behaviors:**
1. **Create mode**: empty form, title "Create Dish"
2. **Edit mode**: pre-filled form, title "Edit Dish"
3. **Special toggle / Meal Time interaction**: when Meal Time = Breakfast,
   the Special checkbox is disabled and forced to unchecked. Switching from
   Lunch → Breakfast while Special is checked unchecks it automatically —
   don't let the form hold an invalid combination even transiently, since
   the server will reject it anyway via the Zod refine.
4. **Validation**: `DishSchema` (client-side mirror + server-side
   authoritative check), field errors shown below inputs
5. **Submit**: calls `createDish`/`updateDish` → on `reused`-style ingredient
   notes, nothing special needed here (that's the sheet's concern) → closes
   dialog → calls `onSaved`
6. **Cancel**: closes without saving
7. **Loading**: disable Save + show a loading state during submission

**Props:**
```typescript
interface DishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dish?: DishWithRelations | null  // null = create, provided = edit
  onSaved: () => void              // callback to refresh the list
}
```

### Step 9: Delete Confirmation Dialog — `components/delete-dish-dialog.tsx`

```
┌─────────────────────────────────────┐
│ Delete Dish                         │
│                                     │
│ Are you sure you want to delete     │
│ "Dish Name"? This action cannot     │
│ be undone.                          │
│                                     │
│         [Cancel]    [Delete]        │
└─────────────────────────────────────┘
```

**Props:**
```typescript
interface DeleteDishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dish: { id: string; name: string } | null
  onDeleted: () => void
}
```

### Step 10: Main Library Component — `app/(dashboard)/dishes/dish-library.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│ Dish Library                              [+ Add Dish]      │
├──────────────────────────────────────────────────────────────┤
│ [All ▼] [All ▼] [Search dishes...____________]              │
│  Cat.   Meal   Search                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                      │
│ │ Dish 1   │ │ Dish 2   │ │ Dish 3   │  ← card grid         │
│ │ ...      │ │ ...      │ │ ...      │                      │
│ └──────────┘ └──────────┘ └──────────┘                      │
│ ┌──────────┐ ┌──────────┐                                    │
│ │ Dish 4   │ │ Dish 5   │                                    │
│ └──────────┘ └──────────┘                                    │
│                                                              │
│ (empty state when no dishes)                                 │
└──────────────────────────────────────────────────────────────┘
```

**State management:**
```typescript
const [dishes, setDishes] = useState<DishWithRelations[]>([])
const [loading, setLoading] = useState(true)
const [filters, setFilters] = useState<DishFilter>({})
const [dishDialogOpen, setDishDialogOpen] = useState(false)
const [editingDish, setEditingDish] = useState<DishWithRelations | null>(null)
const [deletingDish, setDeletingDish] = useState<DishWithRelations | null>(null)
```

**Behaviors:**
1. Fetches dishes on mount and when filters change (debounced search 300ms)
2. Filter bar: category dropdown, meal time dropdown, search input
3. "Add Dish" opens the dialog in create mode
4. Edit button on a card opens the dialog in edit mode
5. Delete button on a card opens the delete confirmation
6. After create/update/delete, refetch the dish list
7. Responsive grid: 1 col mobile, 2 col tablet (`md`), 3 col desktop (`lg`)

### Step 11: Page & Loading

#### `app/(dashboard)/dishes/page.tsx`

Server component wrapper: checks session (redirects to `/sign-in` if absent,
consistent with how `app/(dashboard)/layout.tsx` already handles this),
renders `<DishLibrary />`.

#### `app/(dashboard)/dishes/loading.tsx`

Skeleton loader matching the card grid layout.

---

## Files

### Create — 3A

| File | Purpose |
|---|---|
| `lib/zod/dish.ts` | `DishSchema` (with Special/Breakfast refine), `DishFilterSchema` |
| `lib/zod/ingredient.ts` | `IngredientSchema` |
| `app/actions/dishes.ts` | `getDishes`, `getDishById`, `createDish`, `updateDish`, `deleteDish` |
| `app/actions/ingredients.ts` | `getIngredients`, `createIngredient`, `updateIngredient`, `deleteIngredient` |

### Create — 3B

| File | Purpose |
|---|---|
| `components/ingredient-sheet.tsx` | Slide-out ingredient management drawer |
| `components/ingredient-combobox.tsx` | Searchable multi-select, opens the sheet |

### Create — 3C

| File | Purpose |
|---|---|
| `components/category-badge.tsx` | Category display badge |
| `components/flavor-tag.tsx` | Flavor chip |
| `components/dish-card.tsx` | Dish grid card |
| `components/dish-dialog.tsx` | Create/Edit dish dialog |
| `components/delete-dish-dialog.tsx` | Delete confirmation |
| `app/(dashboard)/dishes/dish-library.tsx` | Main client UI: grid, filters, search |
| `app/(dashboard)/dishes/page.tsx` | Server wrapper |
| `app/(dashboard)/dishes/loading.tsx` | Skeleton loader |

---

## Implementation Order

| # | Task | Sub-phase | Complexity |
|---|------|-----------|------------|
| 1 | Zod schemas | 3A | Low |
| 2 | Server actions (dishes + ingredients) | 3A | Medium |
| 3 | Install shadcn: sheet, command, popover | 3B | Low |
| 4 | Ingredient sheet | 3B | Medium |
| 5 | Ingredient combobox | 3B | Medium |
| 6 | Install shadcn: badge, select, dialog, alert-dialog | 3C | Low |
| 7 | Display components (badge, flavor-tag, dish-card) | 3C | Low |
| 8 | Dish form dialog | 3C | High |
| 9 | Delete dialog | 3C | Low |
| 10 | Main library component | 3C | High |
| 11 | Page + loading | 3C | Low |

---

## Key Design Decisions Recap

1. **Soft-delete**: `deleteDish` sets `isArchived = true`, never hard deletes
2. **User isolation**: all queries filter by `userId` from session
3. **Ingredient + flavor uniqueness**: case-insensitive, enforced in the
   Server Action (not just the DB constraint) — see Design Decisions table.
   Flavors use a shared `Flavor` registry per user; `DishFlavor` is a
   junction table, not a text column
4. **Ingredient delete guard**: scoped to active dishes only; cascading
   deletion of historical `ShoppingListItem` rows is intentional
5. **Special + Breakfast**: mutually exclusive, enforced server-side via Zod
   refine and client-side via disabled UI
6. **Form state**: React `useState` for dialog forms, not URL params
7. **Search debouncing**: 300ms before filtering
8. **Ingredient sheet/combobox sync**: explicit `onChange` callback, not an
   implicit "close and hope it refetched" assumption
9. **No optimistic updates**: refetch after mutations for data consistency
10. **Server Action return shape**: `{ success, data } | { success, error }`
    everywhere, no exceptions

---

## Acceptance Criteria

- [ ] User can create a dish with name, category, meal time, special flag,
      flavors, and ingredients
- [ ] Special flag is disabled/unchecked whenever Meal Time = Breakfast, and
      a direct server call with that invalid combination is rejected
- [ ] User can edit all dish fields
- [ ] User can soft-delete a dish (disappears from the list, stays in DB)
- [ ] Dish list is paginated (12 per page); prev/next controls render when
      there is more than one page; page resets to 1 when any filter changes
- [ ] Filter by category works (All + each category)
- [ ] Filter by meal time works (All, Breakfast, Lunch)
- [ ] Search by dish name works with debounce
- [ ] Ingredient sheet opens from the dish form and stays in sync with the
      combobox without a manual refresh
- [ ] Adding an ingredient that already exists (any casing) reuses the
      existing row instead of creating a duplicate or erroring
- [ ] Renaming an ingredient to collide (any casing) with a different
      existing ingredient is blocked with a clear error
- [ ] Ingredient delete is blocked only while an **active** dish uses it;
      deleting an ingredient unused by any active dish succeeds even if
      archived dishes or past shopping lists still reference it
- [ ] Adding the same flavor twice with different casing results in one
      `DishFlavor` row, not two — and only one `Flavor` registry row per
      unique name per user
- [ ] All forms show validation errors
- [ ] Loading states shown during data fetches
- [ ] Empty states shown when no dishes/ingredients exist
- [ ] Every Server Action in `dishes.ts`/`ingredients.ts` returns
      `{ success, data } | { success, error }` — verified by reading the
      code, not just by testing the happy path

---

## Deferred to Phase 4+

- Cross-dish, case-insensitive flavor comparison inside `lib/planner`
  (now simpler with `Flavor` registry — can query by `flavorId` directly;
  this phase only dedupes *within* a single dish's own flavor list)
- A visible note in `architecture.md` Invariant 3 documenting the ingredient-
  deletion cascade as an explicit, intentional exception
- Archived-dish browsing/restore UI (still out of v1 scope, per
  `project-overview.md`)
- Sort order on the dish grid (currently always `createdAt desc`; may want
  user-selectable sort in a future phase)
- Archived-dish browsing/restore UI (still out of v1 scope, per
  `project-overview.md`)
- Cross-dish, case-insensitive flavor comparison inside `lib/planner`
  (now simpler with `Flavor` registry — can query by `flavorId` directly;
  this phase only dedupes *within* a single dish's own flavor list)
- A visible note in `architecture.md` Invariant 3 documenting the ingredient-
  deletion cascade as an explicit, intentional exception