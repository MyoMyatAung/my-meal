# Phase 5 — Plan Generation + Dashboard

## Goal

Wire the Phase 4 planner engine to the database via Server Actions, build the Dashboard with plan summary, and build the Plan page with generate form and day-card view.

## Deliverable

Generate plans from the Dashboard/Plan page, view them with day cards and dish pills. Dashboard shows active plan summary and a blocking banner when the dish library is too small.

> **Revision note:** this replaces the earlier draft of this plan. Four
> issues were resolved before continuing — plan deletion contradicting
> Phase 7's history requirement, warnings not surviving `router.refresh()`,
> missing calendar-date/timezone handling, and a transaction return-value
> scoping bug — see **Design Decisions** below. The phase is also split into
> three independently-verifiable sub-units (5A / 5B / 5C), per
> `ai-workflow-rules.md`'s rule that a Server Action must be verified before
> the UI that calls it, and that `app/plan/` and the Dashboard root are
> separate boundaries even though both render under `app/(dashboard)/`.

---

## Flow (from prototypes)

```
Dashboard (/)
  ├── Blocking banner (if <1 Breakfast or <2 Lunch dishes)
  ├── "Current plan" summary card → /plan
  ├── "Shopping list" summary card → /shopping-list
  └── Quick links: Dishes, Generate new plan → /plan (generate mode), History

Plan (/plan)
  ├── No active plan → Generate Plan form (start date, duration, preview)
  ├── Has active plan → Plan View (day cards with dish pills, warnings banner)
  └── "Generate New Plan" button → switches to generate form
```

After generating, the user is immediately shown the plan view on `/plan` (via `router.refresh()`). Generating again does **not** delete the previous plan — it creates a new `MealPlan` row. "Current plan" is simply the most recent one; older plans remain in the database for Phase 7's history browsing.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Single active plan | **No deletion.** Generation always creates a **new** `MealPlan` row. "Current plan" = most recent (`orderBy createdAt desc`, `findFirst` — `getCurrentPlan()` already expresses this correctly with no change needed). Older plans stay queryable. | `project-overview.md` explicitly lists "Plan History — Browse past plans, newest first" as in-scope v1 (Features, Core User Flow #4). Deleting on every regenerate would make that feature undeliverable in Phase 7 with zero historical data to browse. |
| Plan warnings persistence | **New `warnings Json` field on `MealPlan`** (`@default("[]")`), populated from `GenerationOutput.warnings` (`PlannerWarning[]`) inside the same transaction that creates the plan. `getCurrentPlan()` returns it as part of the plan; the UI reads it from the fetched plan record, never from client-side generation-call memory. | Invariant 6 ("never fails silently") means a relaxation has to stay visible — not just flash once right after generation and vanish on the next `router.refresh()` or page revisit. Storing as `Json` avoids a new table for a small, plan-scoped, write-once array. **Protected-file flag:** `prisma/schema.prisma` needs explicit confirmation before this migration — see Step 0 below. |
| Date storage vs. display | **Calendar-date fields are UTC-anchored at the boundary, not displayed via local-timezone conversion.** `MealPlan.startDate` / `endDate` and `MealPlanEntry.date` represent *which day*, not a moment in time. Store them as UTC via Prisma's `DateTime` (consistent with the general "store UTC, display locale" rule used for true timestamps like `createdAt`), but parse the incoming `"YYYY-MM-DD"` string as **UTC midnight** (`` `${dateStr}T00:00:00.000Z` ``) and format for display using UTC-based getters (`timeZone: "UTC"`) — never plain `toLocaleDateString()` on these fields. | A genuine timestamp (`createdAt`) correctly shifts when shown in the viewer's local time — that part of the general rule is unchanged and still applies there. A calendar-only date has no "time of day" to shift; running it through local-timezone display would silently roll the displayed day backward or forward for any user not on UTC, which breaks Special-Day-on-Saturday/Sunday logic and every day-card heading. This is a deliberate, scoped exception to the general convention, flagged explicitly so it isn't applied uniformly by accident. |
| `lib/planner/generate.ts` date arithmetic | **Verification item, not a Step-5 change.** Phase 4 is already built and tested; Phase 5 only needs to confirm its internal date arithmetic (window chunking, weekend selection) uses UTC-safe methods (`setUTCDate`) rather than local-zone ones (`setDate`). If it currently uses local-zone arithmetic, that's the actual point where the UTC-anchoring decision above would silently break, and needs a small Phase 4 patch + re-run of `npx vitest run` before 5A is considered verified. | Phase 5 passes a UTC-midnight `Date` in; if the planner then does local-zone day arithmetic on it, the *output* entry dates can drift a day depending on the server's local timezone, even though Phase 5's own input parsing is correct. This is a boundary-coupling risk between an already-completed phase and this one — surfacing it here rather than assuming it's fine. |
| Gate thresholds | **Exported as named constants from `lib/planner/gate.ts`** (`MIN_BREAKFAST_DISHES = 1`, `MIN_LUNCH_DISHES = 2`), imported by the Dashboard banner instead of re-hardcoding `< 1` / `< 2`. | Two independent hardcoded copies of the same rule (the gate's internal check and the Dashboard's display condition) drift the moment the rule ever changes. This is a one-line additive export to an already-tested Phase 4 file — no logic change — but `npx vitest run` should be re-run after touching it. |
| Gate error shape | `PreFlightGateError.errors` (`string[]`) is joined into a single string (`e.errors.join("; ")`) before being returned from `generatePlanAction`. | `code-standards.md`'s Server Action return shape is `{ success: false, error: string }`. A bare `string[]` doesn't match that contract and would force every caller to special-case this one action. |
| Entry / dish / shopping-item writes | `MealPlanEntry` rows are still created one-by-one in a loop (each needs its own generated ID before its child `MealPlanEntryDish` rows can reference it), but `MealPlanEntryDish` rows **within** an entry, and all `ShoppingListItem` rows across the whole plan, use `createMany` instead of one `create()` per row. | `createMany` can't return generated IDs, so it can't replace the entry loop directly — but nothing downstream needs per-row IDs for plan-entry-dishes or shopping items, so batching those is a safe, free performance win inside the same transaction. |
| Transaction return value | `prisma.$transaction(async (tx) => { ...; return createdPlan })`, captured as `const plan = await prisma.$transaction(...)`. `plan.id` is then used after the transaction closes (for the action's return value), never referenced from inside a now-closed callback scope. | The original draft defined `plan` only inside the callback and then referenced `plan.id` outside it — that doesn't compile; `tx` callbacks must explicitly `return` whatever the caller needs afterward. |
| Ingredient resolution | Unchanged — pre-fetch user ingredients into a `Map<name, id>` before the transaction. | Planner outputs `ingredientName` strings; DB needs `ingredientId` FK. Batch lookup avoids N+1. |
| Blocking banner location | Unchanged — Dashboard only. | Per `architecture.md` invariant #6: "surfaced on the Dashboard, not the Generate screen." |
| Post-generation redirect | Unchanged — `router.refresh()` on `/plan`. | User immediately sees the plan view without a full navigation; warnings now persist through this refresh because they're read from the DB record, not memory. |
| "Regenerate" renamed to "Generate New Plan" | Unchanged — user request. | Clearer intent — it's a new plan, not a re-run of the same one. |
| `ShoppingListItem.ingredientId` | Unchanged — look up by name from pre-fetched map; skip (don't fail) if missing. | Ingredients should already exist (dishes reference them), but defensive fallback prevents failures. |

---

## Sub-phase Split

This phase is **three** separable units, per `ai-workflow-rules.md`:

- **5A — Schema + Data layer**: `prisma/schema.prisma` migration (warnings field), calendar-date utilities, Zod schema, `app/actions/plan.ts`. No UI. Verify directly before writing a single component.
- **5B — Plan page**: Generate form, Plan view, Day card, Dish pill. Depends only on 5A. Verify end-to-end — including "generate → see warning → refresh page → warning still visible" — before touching the Dashboard.
- **5C — Dashboard**: blocking banner, summary cards, quick links. Depends on 5A; reads but does not modify anything from 5B.

---

## Phase 5A — Schema + Data Layer

### Step 0: Schema Change — confirm before applying

`prisma/schema.prisma` is a protected file (`ai-workflow-rules.md`). This is the one schema change Phase 5 requires — everything else in this phase reads/writes through existing models:

```prisma
model MealPlan {
  id            String              @id @default(cuid())
  startDate     DateTime
  endDate       DateTime
  warnings      Json                @default("[]")   // snapshot of PlannerWarning[]
  userId        String
  user          User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries       MealPlanEntry[]
  shoppingItems ShoppingListItem[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}
```

Only the `warnings Json @default("[]")` line is new versus the Phase 1 schema. Once confirmed:

```bash
npx prisma migrate dev --name add_plan_warnings
```

### Step 1: Calendar-date utilities

**File:** `lib/utils/date.ts` (create)

```typescript
/**
 * Parses a "YYYY-MM-DD" wall-clock date string into a UTC-midnight Date.
 * Use this for any calendar-only field (MealPlan.startDate/endDate,
 * MealPlanEntry.date) — never `new Date(str)` directly on these, since
 * that's parsed against the server's local zone and can land on the
 * wrong UTC day.
 */
export function parseCalendarDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/**
 * Formats a calendar-only Date using UTC getters, so the displayed day
 * never shifts based on the viewer's local timezone.
 */
export function formatCalendarDate(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" })
}

/**
 * Adds `days` to a "YYYY-MM-DD" calendar date string and returns the
 * result in the same format. Used for the Generate form's end-date preview.
 */
export function addDaysToCalendarDate(dateStr: string, days: number): string {
  const d = parseCalendarDate(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
```

True timestamps (`createdAt`, `updatedAt`) are unaffected by this module — display those with plain `toLocaleString()` per the general store-UTC/display-locale convention. Only calendar-only fields go through `lib/utils/date.ts`.

### Step 2: Zod Schema for Plan Generation

**File:** `lib/zod/plan.ts` (create)

```typescript
import { z } from "zod"

export const GeneratePlanSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  durationDays: z
    .number()
    .int()
    .min(1, "Duration must be at least 1 day")
    .max(365, "Duration cannot exceed 365 days")
    .default(14),
})

export type GeneratePlanInput = z.infer<typeof GeneratePlanSchema>
```

### Step 3: Plan Server Actions

**File:** `app/actions/plan.ts` (create)

#### `generatePlanAction({ startDate, durationDays })`

1. Get `userId` from session (via `getUserId()` helper, same pattern as `dishes.ts`)
2. Validate input with `GeneratePlanSchema`
3. Fetch all non-archived dishes for the user with flavors + ingredients:

   ```typescript
   const dishes = await prisma.dish.findMany({
     where: { userId, isArchived: false },
     include: {
       flavors: { select: { flavor: { select: { name: true } } } },
       ingredients: { select: { ingredient: { select: { id: true, name: true } } } },
     },
   })
   ```

4. Map to `PlannerDish[]`:

   ```typescript
   const plannerDishes: PlannerDish[] = dishes.map((d) => ({
     id: d.id,
     name: d.name,
     mealTime: d.mealTime,
     isSpecial: d.isSpecial,
     flavors: d.flavors.map((df) => df.flavor.name),
     ingredientNames: d.ingredients.map((di) => di.ingredient.name),
   }))
   ```

5. Build ingredient name → ID map from the fetched dishes' ingredients (avoids an extra query):

   ```typescript
   const ingredientMap = new Map<string, string>()
   for (const d of dishes) {
     for (const di of d.ingredients) {
       ingredientMap.set(di.ingredient.name, di.ingredient.id)
     }
   }
   ```

6. Convert the input date and call the planner:

   ```typescript
   import { parseCalendarDate } from "@/lib/utils/date"

   const output = generatePlan({
     dishes: plannerDishes,
     startDate: parseCalendarDate(input.startDate),
     durationDays: input.durationDays,
   })
   ```

7. Catch `PreFlightGateError` → return a single joined string, per the standard Server Action shape:

   ```typescript
   catch (e) {
     if (e instanceof PreFlightGateError) {
       return { success: false as const, error: e.errors.join("; ") }
     }
     throw e
   }
   ```

8. **Single Prisma transaction** — creates the plan, never deletes a prior one; batches dish-links and shopping items with `createMany`; returns the created plan so its `id` is usable after the transaction closes:

   ```typescript
   const lastEntry = output.entries[output.entries.length - 1]

   const plan = await prisma.$transaction(async (tx) => {
     const createdPlan = await tx.mealPlan.create({
       data: {
         startDate: parseCalendarDate(input.startDate),
         endDate: lastEntry.date,
         warnings: output.warnings,
         userId,
       },
     })

     for (const entry of output.entries) {
       const dbEntry = await tx.mealPlanEntry.create({
         data: {
           date: entry.date,
           mealTime: entry.mealTime,
           mealPlanId: createdPlan.id,
         },
       })

       if (entry.dishes.length > 0) {
         await tx.mealPlanEntryDish.createMany({
           data: entry.dishes.map((dish) => ({
             entryId: dbEntry.id,
             dishId: dish.dishId,
             sortOrder: dish.sortOrder,
           })),
         })
       }
     }

     const shoppingItemsData = output.shoppingItems
       .map((item) => {
         const ingredientId = ingredientMap.get(item.ingredientName)
         if (!ingredientId) return null // defensive: skip if ingredient not found
         return {
           mealPlanId: createdPlan.id,
           ingredientId,
           dishName: item.dishName,
         }
       })
       .filter((row): row is NonNullable<typeof row> => row !== null)

     if (shoppingItemsData.length > 0) {
       await tx.shoppingListItem.createMany({ data: shoppingItemsData })
     }

     return createdPlan
   })

   return { success: true as const, data: { planId: plan.id } }
   ```

   No `mealPlan.delete()` anywhere in this action — every generation simply adds a new row.

#### `getCurrentPlan()`

1. Get `userId` from session
2. Fetch the most recent `MealPlan` (this *is* the "current plan" definition — no separate flag needed):

   ```typescript
   const plan = await prisma.mealPlan.findFirst({
     where: { userId },
     orderBy: { createdAt: "desc" },
     include: {
       entries: {
         include: {
           dishes: {
             include: { dish: { select: { id: true, name: true, category: true, isSpecial: true } } },
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
   ```

3. Return plan (now including its persisted `warnings: PlannerWarning[]` field) or `null`

#### `getDishCounts()`

1. Get `userId` from session
2. Run two counts in parallel:

   ```typescript
   const [breakfast, lunch] = await Promise.all([
     prisma.dish.count({ where: { userId, isArchived: false, mealTime: "Breakfast" } }),
     prisma.dish.count({ where: { userId, isArchived: false, mealTime: "Lunch" } }),
   ])
   ```

3. Return `{ breakfast, lunch }`

### Step 4: Gate constants export

**File:** `lib/planner/gate.ts` (modify — additive only)

Export the two threshold values already used inside `checkPreFlightGate` as named constants, so the Dashboard (5C) imports them instead of re-hardcoding:

```typescript
export const MIN_BREAKFAST_DISHES = 1
export const MIN_LUNCH_DISHES = 2
```

Re-run `npx vitest run` after this change — it's additive, but Phase 4's test suite is the source of truth that nothing shifted.

### ✅ Verify 5A Before Moving to 5B

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` | Passes |
| 2 | `pnpm run build` | Passes |
| 3 | `npx vitest run` | Still passes after the `gate.ts` export change |
| 4 | Migration applied | `npx prisma migrate status` shows `add_plan_warnings` applied |
| 5 | No deletion on regenerate | Call `generatePlanAction` twice in a row for the same user (scratch script or Vitest) — confirm **two** `MealPlan` rows exist in the DB afterward, not one |
| 6 | "Current" = most recent | After the two calls above, `getCurrentPlan()` returns the **second** plan's data |
| 7 | Warnings round-trip | Use a fixture-like small library that forces a relaxation (e.g. no `isSpecial` dish) — confirm the resulting `MealPlan.warnings` is a non-empty array matching `generatePlan()`'s output, and that `getCurrentPlan()` returns it unchanged on a fresh fetch |
| 8 | Date doesn't shift | Generate with `startDate: "2026-07-01"` from a server process *not* running in UTC (or temporarily set `TZ=America/New_York` for the test run) — confirm the stored/returned date still represents July 1, not June 30 |
| 9 | `lib/planner/generate.ts` date arithmetic | Read Step 3 (window chunking) and Step 5 (weekend/lunch sizing) of `generate.ts` — confirm `setUTCDate`/UTC-safe arithmetic is used, not `setDate`. If it isn't, patch it now and re-run `npx vitest run` before continuing |

**Do not start 5B until all nine checks pass.**

---

## Phase 5B — Plan Page

### Step 5: Plan Page

**File:** `app/(dashboard)/plan/page.tsx` (create)

Server Component. Fetches `getCurrentPlan()` and `getServerSession()`.

- If `plan` is `null` → render `<GeneratePlanForm />`
- If `plan` exists → render `<PlanView plan={plan} />`, passing `plan.warnings` straight through (already persisted — no separate prop needed)

Pass plan data as serialized props (use `JSON.parse(JSON.stringify(plan))` to handle `Date` objects).

### Step 6: Generate Plan Form Component

**File:** `components/generate-plan-form.tsx` (create)

Client component (`"use client"`).

#### Layout

Matches `plan-generate.html` prototype:

```
← Dashboard

Generate plan

These settings control this plan and how future plans are scheduled.

┌─────────────────────────────────────────┐
│ Start date                              │
│ [2026-06-30         ]                   │
│                                         │
│ Duration                                │
│ [  2 ] [Weeks | Days]                   │
│ Default: 2 weeks (14 days)              │
│                                         │
│ This plan runs Jun 30 to Jul 13.        │
└─────────────────────────────────────────┘

                        [Cancel] [Generate plan]
```

#### State

```typescript
const [startDate, setStartDate] = useState(todayStr) // YYYY-MM-DD
const [durationValue, setDurationValue] = useState(2)
const [durationUnit, setDurationUnit] = useState<"Weeks" | "Days">("Weeks")
const [isGenerating, setIsGenerating] = useState(false)
const [error, setError] = useState<string | null>(null)
```

#### Computed

Uses the Step 1 calendar-date utilities — not raw `Date` math or local `toLocaleDateString`:

```typescript
import { addDaysToCalendarDate, formatCalendarDate, parseCalendarDate } from "@/lib/utils/date"

const durationDays = durationUnit === "Weeks" ? durationValue * 7 : durationValue
const endDateStr = addDaysToCalendarDate(startDate, durationDays - 1)
const previewText = `This plan runs ${formatCalendarDate(parseCalendarDate(startDate), { month: "short", day: "numeric" })} to ${formatCalendarDate(parseCalendarDate(endDateStr), { month: "short", day: "numeric" })}.`
```

#### Behavior

- Cancel → `router.back()` or `router.push("/")`
- Generate → call `generatePlanAction({ startDate, durationDays })`
  - On success → `router.refresh()` (re-fetches server component, now shows `PlanView` with warnings already attached to the fetched plan)
  - On gate error → display `result.error` (now a single string) inline (red text)
  - On other error → "Something went wrong. Please try again."
- Loading state: disable buttons + show spinner during generation

### Step 7: Plan View Component

**File:** `components/plan-view.tsx` (create)

Client component receiving plan data as props.

#### Props

```typescript
interface PlanViewProps {
  plan: {
    id: string
    startDate: string  // ISO string after JSON serialization
    endDate: string
    warnings: { code: string; message: string }[]  // persisted on MealPlan, always present
    entries: {
      id: string
      date: string
      mealTime: "Breakfast" | "Lunch"
      dishes: {
        id: string
        dish: { id: string; name: string; category: string; isSpecial: boolean }
        sortOrder: number
      }[]
    }[]
  }
}
```

#### Layout

Matches `plan-view.html` prototype:

```
Jun 22 – Jul 5          [Generate New Plan] [Edit plan]

View past plans →

⚠️ Not enough special dishes — Special Day skipped for the week of Jun 22.   ← from plan.warnings, persists across refresh

── Week 1 ──

┌─────────────────────────────────────────┐
│ Mon, Jun 22                             │
│ ☀️ Breakfast   Avocado toast             │
│ 🍴 Lunch       Chicken potato curry     │
│                 Mushroom spinach         │
└─────────────────────────────────────────┘
...
┌─────────────────────────────────────────┐
│ Sat, Jun 27  [Special day]              │  ← accent border + badge
│ ☀️ Breakfast   Banana oat pancakes       │
│ 🍴 Lunch       ⭐ Hainanese chicken rice │  ← accent badge + star
└─────────────────────────────────────────┘
...

── Week 2 ──
...
```

#### Implementation Notes

- Header: format dates with `formatCalendarDate(new Date(plan.startDate), { month: "short", day: "numeric" })` — not `toLocaleDateString` directly
- "Special day" badge derivation: an entry is a special day if its `mealTime === "Lunch"` and exactly one dish with `dish.isSpecial === true` is present — this is derived from the entry's own dishes, not a separate `isSpecialDay` flag (the Prisma schema doesn't store one; the planner's `PlannerEntry.isSpecialDay` was a generation-time concept that doesn't need its own DB column when it's reconstructible from the persisted dish set)
- Group entries by week (chunks of 7 days starting from `plan.startDate`)
- Warnings: render `plan.warnings` as an alert/banner above the day cards whenever the array is non-empty — sourced from the fetched plan, so it's still there after any `router.refresh()` or later visit to `/plan`
- "Generate New Plan" button → toggle back to the generate form (e.g. `setShowGenerate(true)`)
- "Edit plan" button → Phase 6 (disabled/hidden for now)
- "View past plans →" → Phase 7 (hidden for now)

### Step 8: Day Card Component

**File:** `components/day-card.tsx` (create)

#### Props

```typescript
interface DayCardProps {
  date: Date
  breakfast: { dishId: string; dishName: string }[]
  lunch: { dishId: string; dishName: string; sortOrder: number; isSpecial: boolean }[]
  isSpecialDay: boolean
}
```

#### Layout

```tsx
import { formatCalendarDate } from "@/lib/utils/date"

<Card className={isSpecialDay ? "border-accent" : ""}>
  <CardContent className="p-4">
    <h2 className="mb-3 text-sm font-semibold">
      {formatCalendarDate(date, { weekday: "short", month: "short", day: "numeric" })}
      {isSpecialDay && <Badge variant="accent" className="ml-2">Special day</Badge>}
    </h2>

    <div className="flex items-center gap-2 mb-2">
      <SunIcon className="size-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground w-16">Breakfast</span>
      <div className="flex flex-wrap gap-1.5">
        {breakfast.map((d) => <DishPill key={d.dishId} name={d.dishName} />)}
      </div>
    </div>

    <div className="flex items-center gap-2">
      <UtensilsIcon className="size-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground w-16">Lunch</span>
      <div className="flex flex-wrap gap-1.5">
        {lunch.map((d) => (
          <DishPill key={d.dishId} name={d.dishName} isSpecial={d.isSpecial} />
        ))}
      </div>
    </div>
  </CardContent>
</Card>
```

Note `formatCalendarDate` (UTC-anchored), not `date.toLocaleDateString(...)` directly — this is the one place the original draft's heading helper would have silently shifted the day for non-UTC viewers.

### Step 9: Dish Pill Component

**File:** `components/dish-pill.tsx` (create)

Unchanged from the original draft:

```tsx
import { Badge } from "@/components/ui/badge"
import { Star } from "lucide-react"

interface DishPillProps {
  name: string
  isSpecial?: boolean
}

export function DishPill({ name, isSpecial }: DishPillProps) {
  if (isSpecial) {
    return (
      <Badge className="bg-accent text-accent-foreground gap-1">
        <Star className="size-3 fill-current" />
        {name}
      </Badge>
    )
  }
  return <Badge variant="secondary">{name}</Badge>
}
```

### ✅ Verify 5B Before Moving to 5C

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` / `pnpm run build` | Pass |
| 2 | Generate → view | Form creates a plan and immediately shows the plan view via `router.refresh()` |
| 3 | Day cards | Breakfast + lunch dish pills render correctly, grouped by week |
| 4 | Special day | Accent border, "Special day" badge, and star icon all present together on the right day |
| 5 | **Warnings persist across refresh** | Force a relaxation scenario, generate, confirm the warning banner shows — then hard-refresh the browser tab (not just `router.refresh()`) and confirm the banner is still there, read from the DB-stored `plan.warnings` |
| 6 | No date drift in UI | With the browser/system in a non-UTC timezone, confirm day-card headings and the plan header date range match the dates actually selected in the generate form |
| 7 | "Generate New Plan" | Returns to the generate form without losing the previous plan (confirm via 5A's verification pattern — DB still has the old row) |
| 8 | Mobile responsive | Sidebar collapses, cards stack vertically |

---

## Phase 5C — Dashboard

### Step 10: Dashboard Page

**File:** `app/(dashboard)/page.tsx` (rewrite)

Server Component. Fetches `getCurrentPlan()`, `getDishCounts()`, and `getServerSession()`.

#### Layout

```
┌─────────────────────────────────────────┐
│ Good morning, {name}                    │
│ Wednesday, June 24, 2026                │
├─────────────────────────────────────────┤
│ ⚠️ You need at least 1 Breakfast dish   │  ← only if gate blocked
│    and 2 Lunch dishes to generate a     │
│    plan. [Add dishes →]                 │
├──────────────────┬──────────────────────┤
│ Current plan     │ Shopping list        │  ← only if plan exists
│ Jun 22 – Jul 5   │ 5 of 14 checked     │
│ 14 breakfasts ·  │ From your current    │
│ 14 lunches       │ plan                 │
│ View plan →      │ Open list →          │
├──────────────────┴──────────────────────┤
│ Quick links                             │
│ ┌──────┐ ┌──────────────┐ ┌──────────┐ │
│ │Dishes│ │Generate new  │ │ History  │ │
│ │      │ │plan          │ │          │ │
│ └──────┘ └──────────────┘ └──────────┘ │
└─────────────────────────────────────────┘
```

#### Implementation Notes

- Greeting date (a true "right now" value, not a calendar-plan field): plain `toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })` is correct here — this is the one date on the page that *is* the viewer's local "today," not a stored calendar field
- Summary cards only render when `plan` is not `null`
- Blocking banner, using the Step 4 shared constants instead of re-hardcoding the thresholds:

  ```typescript
  import { MIN_BREAKFAST_DISHES, MIN_LUNCH_DISHES } from "@/lib/planner/gate"

  const isBlocked = counts.breakfast < MIN_BREAKFAST_DISHES || counts.lunch < MIN_LUNCH_DISHES
  ```

  Render a warning Card with a `TriangleAlert` icon and "Add dishes →" link to `/dishes` when `isBlocked`.
- Plan summary card's date range: `formatCalendarDate(new Date(plan.startDate), {...})` — same UTC-anchored helper as Step 7/8, not local formatting
- Quick links: use `<Link>` with the same tile-link pattern from the prototype (Card with icon + label + hint)

### ✅ Verify 5C (and overall Phase 5)

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` | Zero errors |
| 2 | `pnpm run build` | Passes |
| 3 | `npx vitest run` | Planner tests still pass |
| 4 | Dashboard renders | Greeting, blocking banner when applicable, summary cards, quick links |
| 5 | Blocking banner uses shared constants | Confirm by temporarily changing `MIN_LUNCH_DISHES` in `gate.ts` and seeing the Dashboard banner threshold move with it (then revert) |
| 6 | Summary card date range | Matches the actual plan dates, independent of viewer timezone |
| 7 | Quick links | All three tiles navigate correctly |
| 8 | Mobile responsive | Cards stack, sidebar collapses |

---

## Files Summary

| File | Action | Sub-phase | Description |
|---|---|---|---|
| `prisma/schema.prisma` | Modify (confirm first) | 5A | Add `warnings Json @default("[]")` to `MealPlan` |
| `lib/utils/date.ts` | Create | 5A | `parseCalendarDate`, `formatCalendarDate`, `addDaysToCalendarDate` |
| `lib/zod/plan.ts` | Create | 5A | `GeneratePlanSchema` |
| `app/actions/plan.ts` | Create | 5A | `generatePlanAction`, `getCurrentPlan`, `getDishCounts` |
| `lib/planner/gate.ts` | Modify (additive) | 5A | Export `MIN_BREAKFAST_DISHES`, `MIN_LUNCH_DISHES` |
| `app/(dashboard)/plan/page.tsx` | Create | 5B | Plan page: conditionally renders form or view |
| `components/generate-plan-form.tsx` | Create | 5B | Client form: start date, duration, preview, generate |
| `components/plan-view.tsx` | Create | 5B | Header, persisted-warnings banner, day cards grouped by week |
| `components/day-card.tsx` | Create | 5B | Single day card with breakfast + lunch rows |
| `components/dish-pill.tsx` | Create | 5B | Badge showing dish name, optional star for special |
| `app/(dashboard)/page.tsx` | Rewrite | 5C | Dashboard: greeting, blocking banner, summary cards, quick links |
| `.agents/context/features/05-plan-generation-and-dashboard.md` | Update | — | This plan document |
| `.agents/context/progress-tracker.md` | Update | — | Mark Phase 5 complete |

---

## Key Constraints

- `lib/planner/*` core algorithm remains unchanged — only an additive constants export in `gate.ts`
- All Server Actions scope to `session.user.id`
- Generation writes plan + entries + dishes + shopping items in a single `$transaction`; it never deletes a prior `MealPlan`
- Plan warnings are persisted on `MealPlan.warnings`, not held only in client memory
- Calendar-only date fields (`MealPlan.startDate/endDate`, `MealPlanEntry.date`) always go through `lib/utils/date.ts` — never raw `new Date(str)` or `toLocaleDateString()` without `timeZone: "UTC"`
- Dish deletion is soft (`isArchived`) — existing plan references remain valid
- No `rounded-*` Tailwind classes (radius is 0 everywhere)
- Use CSS custom property tokens via Tailwind utilities, no hardcoded colors

---

## Overall Verification Checklist

1. `npm run typecheck` — zero errors
2. `npm run build` — passes
3. `npx vitest run` — planner tests still pass
4. Migration `add_plan_warnings` applied
5. Regenerating a plan never deletes the previous `MealPlan` row
6. Warning banner survives a full page refresh, not just `router.refresh()`
7. Day-card and plan-header dates don't shift under a non-UTC system timezone
8. Dashboard shows greeting, blocking banner when applicable, summary cards, quick links
9. Special day card has accent border, "Special day" badge, and star icon on the dish
10. Blocking banner threshold is driven by `lib/planner/gate.ts`'s exported constants, not a local hardcode
11. Mobile responsive (sidebar collapses, cards stack vertically)