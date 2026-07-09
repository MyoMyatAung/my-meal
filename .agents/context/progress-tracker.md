# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 8 — Dish Pairing + Updated Plan Generation Rules: Completed

## Current Goal

- None — all planned phases (1–8) complete.

## Completed

- Bugfix: Breakfast no-repeat scope changed from period-wide to the
  same per-7-day-block window as Lunch (user report — 9 breakfasts over
  a 14-day plan wrongly repeated one dish 5 days straight). Generator
  now round-robins the shuffled breakfast pool (`breakfastCursor` +
  per-block `weekBreakfastIds`) so forced repeats spread evenly and
  never land on consecutive days; `INSUFFICIENT_BREAKFAST_VARIETY` now
  fires only on an in-block collision. `computeEntryWarnings`
  (`edit-warnings.ts`) now scopes "repeats elsewhere" to a 7-day block
  (needs each entry's `date`; threaded through from `plan.ts`).
  Updated `project-overview.md` rules + generator/edit-warnings tests.
- Phase 8: Dish Pairing + Updated Plan Generation Rules
  - **8A — Dish pairing data layer:**
    - Added `DishPairing` model to `prisma/schema.prisma` (canonical
      `dishAId < dishBId` row per unordered pair, `onDelete: Cascade` both
      sides, `@@unique([dishAId, dishBId])`, `@@index([dishBId])`) and
      `Dish.pairingsAsA`/`pairingsAsB` relations
    - Hand-authored migration `20260703000000_add_dish_pairing`, applied via
      `prisma migrate deploy` (shadow-database replay against Neon fails for
      `prisma migrate dev` in this project — same workaround already used
      for `20260630000000_add_plan_warnings`)
    - Added `pairedDishIds: z.array(z.string().cuid()).max(20).default([])`
      to `DishSchema` in `lib/zod/dish.ts`
    - `app/actions/dishes.ts`: added `syncDishPairings` (diffs desired
      pairing set against existing `DishPairing` rows via
      `OR: [{dishAId}, {dishBId}]`, rejects any target that isn't the
      user's own `mealTime: "Lunch"` dish via `PairingValidationError`),
      wired into `createDish`/`updateDish` inside a `prisma.$transaction`
      alongside the existing flavor/ingredient writes; extended
      `DishWithRelations` with `pairedDishes: {id, name, category}[]`
      (normalized from `pairingsAsA`/`pairingsAsB` via `withPairedDishes`)
  - **8B — Planner core rewrite:**
    - `lib/planner/types.ts`: added `category` (local `Category` union, not
      `@prisma/client`) and `pairedDishIds` to `PlannerDish`; added
      `NO_PAIRED_DISH_FALLBACK` to `WarningCode`
    - `lib/planner/gate.ts`: replaced `MIN_LUNCH_DISHES` with
      `MIN_MAIN_DISHES` (1) and `MIN_SIDE_OR_SOUP_DISHES` (1), each with its
      own named blocking message
    - `lib/planner/rules.ts`: added `sharesFlavor`, `pickPairedSideOrSoup`
      (Main's pairings → same/different-flavor preference roll → fallback
      to the full Side/Soup pool when unpaired), `pickCompensatoryDish`
      (intersection of Main's and Side/Soup's pairings, flavor-clean
      against both, falls back to an unpaired flavor-clean pick)
    - `lib/planner/generate.ts`: rewrote Lunch assignment — Main picked
      non-repeating within a 7-day block (`Math.floor(dayOffset/7)`,
      mirroring the existing 14-day Special Day windowing idiom), Side/Soup
      via `pickPairedSideOrSoup` with a new
      `MAIN_SIDE_SAME_FLAVOR_PROBABILITY = 0.3` roll (replaces the removed
      `LUNCH_THREE_DISH_PROBABILITY`), compensatory 3rd dish via
      `pickCompensatoryDish` only when Main+Side/Soup collided on flavor.
      Breakfast, the pre-flight gate call, and Special Day window/placement
      are unchanged
    - `lib/planner/fixtures.ts`: added `category`/`pairedDishIds` to every
      existing fixture; added `noMainLibrary`, `noSideOrSoupLibrary`,
      `unpairedMainLibrary`, `pairedMixedFlavorLibrary`,
      `triplePairedLibrary`, `compensatoryFallbackLibrary`,
      `weeklyRepeatLibrary`
    - `lib/planner/generate.test.ts`: rewrote gate/pairing/compensatory/
      weekly-repeat test groups (64 tests total); statistical ~30%
      collision-rate check uses a seeded `mulberry32` PRNG over a 700-day
      run, not `Math.random()`, to stay deterministic
  - **8C — Dish form UI:**
    - Added `components/dish-pairing-combobox.tsx` (same search/badge
      interaction shape as `ingredient-combobox.tsx`, no create affordance,
      candidates from `getDishes({ mealTime: "Lunch" })` minus the dish
      being edited)
    - Wired into `dish-dialog.tsx`, rendered only when `mealTime === "Lunch"`
      (auto-clears `pairedDishIds` if switched to Breakfast, mirroring the
      existing `isSpecial` reset effect)
    - Added an optional "Paired with: X, Y" line to `dish-card.tsx`
  - **8D — Dashboard gate banner:**
    - `app/actions/plan.ts`: `generatePlanAction` now maps `category` and
      `pairedDishIds` (resolved from `pairingsAsA`/`pairingsAsB`) into
      `PlannerDish`; `getDishCounts` extended with `main`/`sideOrSoup`
      per-category counts
    - `app/(dashboard)/page.tsx`: blocking banner now lists each missing
      category by name with live counts (Breakfast/Main/Side-or-Soup)
      instead of the old single "Breakfast + 2 Lunch" message
  - Verified: typecheck ✓, build ✓, vitest ✓ (64 tests), manual browser
    walkthrough (sign-up → create paired Main+Side dishes → confirmed
    mutual pairing appears on both cards immediately → generated a plan and
    confirmed the pairing was used for every lunch → edited one dish to
    remove the pairing → confirmed it disappeared from both cards)

- Phase 7: History + Account Settings + Polish
  - **7A — History data layer:**
    - Refactored `getCurrentPlan` in `app/actions/plan.ts` into a shared
      private `findPlanWithWarnings(where, orderBy?)` helper
    - Added `getPlanById(planId)` (scoped to `{ id, userId }`) and
      `getPlanHistory()` (all plans except the most-recently-created
      one, newest first, with computed `dayCount`/`ingredientCount`)
  - **7B — History UI:**
    - Replaced the dead "History coming soon" placeholder in
      `components/plan-view.tsx` with a real `/history` link
    - Added `app/(dashboard)/history/page.tsx` (list, empty state)
    - Added `app/(dashboard)/history/[planId]/page.tsx` (read-only
      detail view, `redirect("/history")` on unknown/foreign id)
  - **7C — Account settings data layer:**
    - Extracted `PasswordSchema` in `lib/zod/auth.ts`, reused by
      `SignUpSchema`
    - Added `lib/zod/settings.ts` (`UpdateNameSchema`,
      `UpdatePasswordSchema`)
    - Added `app/actions/settings.ts` (`updateNameAction`,
      `updatePasswordAction` — bcrypt-verifies current password before
      accepting a new one)
  - **7D — Account settings UI + session sync:**
    - Added `components/session-provider.tsx` (`"use client"` re-export
      wrapper) and mounted it in `app/layout.tsx` — a bare `"use client"`
      import of `next-auth/react`'s `SessionProvider` directly in a
      Server Component broke static generation (`next-auth` v4's
      `react/index.js` ships with no `"use client"` directive of its
      own); the wrapper file fixes this the same way
      `components/theme-provider.tsx` already wraps `next-themes`
    - Extended `lib/auth.ts`'s `jwt` callback with a
      `trigger === "update"` branch
    - Added `app/(dashboard)/settings/page.tsx`,
      `components/update-name-form.tsx` (calls `useSession().update()` +
      `router.refresh()`), `components/update-password-form.tsx`,
      `components/sign-out-button.tsx`
    - Added "Settings" nav entry to `components/sidebar.tsx`
  - Verified: typecheck ✓, build ✓, vitest ✓ (46 tests, unaffected),
    full manual browser walkthrough (sign-up → generate 2 plans →
    archive a dish referenced in the older plan → history list/detail →
    unknown-id redirect → name change with live sidebar sync → wrong/
    weak/mismatched password rejections → successful password change →
    sign-out → sign-in with new password, old password rejected)

- Phase 6: Plan Editing + Shopping List
  - **6A — Data layer + rule reuse:**
    - Widened `hasFlavorCollision` input to `{ flavors: string[] }[]` in `lib/planner/rules.ts`
    - Added `lib/planner/edit-warnings.ts` + `edit-warnings.test.ts` for live per-entry warning computation
    - Extended `getCurrentPlan` in `app/actions/plan.ts` with dish flavor loading and computed `entryWarnings`
    - Added `SwapDishSchema` in `lib/zod/plan.ts`
    - Added `lib/utils/shopping-list-diff.ts` + test and wired transactional shopping-list sync into `swapDishAction`
    - Added `getSwappableDishes` and `swapDishAction` in `app/actions/plan.ts`
    - Added `lib/zod/shopping-list.ts` and `app/actions/shopping-list.ts` (`getCurrentShoppingList`, `toggleShoppingItemAction`)
  - **6B — Plan editing UI:**
    - Installed shadcn components: `carousel`, `sonner`
    - Added `lib/utils/warning-cards.ts` + test
    - Added `components/plan-warnings-carousel.tsx`
    - Enabled Edit flow in `components/plan-view.tsx` and removed old generation banner in favor of consolidated carousel
    - Added `components/editable-dish-pill.tsx` (swap + toast error handling)
    - Updated `components/day-card.tsx` to support editable mode and warning indicator styling
    - Added `components/edit-plan-view.tsx` and `app/(dashboard)/plan/edit/page.tsx`
    - Fixed Dashboard blocking banner color tokens in `app/(dashboard)/page.tsx` (`destructive` tokens)
    - Mounted global toaster in `app/layout.tsx`
  - **6C — Shopping list UI:**
    - Installed shadcn component: `checkbox`
    - Added `components/shopping-list-view.tsx` (optimistic toggle + revert + toast on failure)
    - Added `app/(dashboard)/shopping-list/page.tsx`
  - Verified: typecheck ✓, build ✓, vitest ✓ (46 tests)

- Phase 5: Plan Generation + Dashboard
  - **5A — Schema + Data Layer:**
    - Added `warnings Json @default("[]")` to `MealPlan` in Prisma schema
    - Created migration `20260630000000_add_plan_warnings` (applied via `prisma migrate deploy`)
    - Created `lib/utils/date.ts` (parseCalendarDate, formatCalendarDate, addDaysToCalendarDate — UTC-anchored)
    - Created `lib/zod/plan.ts` (GeneratePlanSchema)
    - Created `app/actions/plan.ts` (generatePlanAction, getCurrentPlan, getDishCounts)
    - Exported `MIN_BREAKFAST_DISHES`, `MIN_LUNCH_DISHES` from `lib/planner/gate.ts`
    - Verified: typecheck ✓, build ✓, vitest ✓ (34 tests), migration ✓
  - **5B — Plan Page:**
    - Created `components/dish-pill.tsx` (badge with optional star for special)
    - Created `components/day-card.tsx` (breakfast + lunch rows, special day accent)
    - Created `components/generate-plan-form.tsx` (start date, duration weeks/days, preview)
    - Created `components/plan-view.tsx` (header, warnings banner, day cards grouped by week)
    - Created `app/(dashboard)/plan/page.tsx` (server component — form or view)
    - Verified: typecheck ✓, build ✓, vitest ✓
  - **5C — Dashboard:**
    - Rewrote `app/(dashboard)/page.tsx` (greeting, blocking banner, summary cards, quick links)
    - Blocking banner uses exported gate constants from `lib/planner/gate.ts`
    - Summary cards show plan date range and shopping list progress
    - Quick links: Dishes, Generate new plan, History
    - Verified: typecheck ✓, build ✓, vitest ✓

- Phase 4: Planner Core (pure logic, no UI)
  - Installed Vitest, created `vitest.config.ts`, added `test` script
  - Created `lib/planner/types.ts` (PlannerDish, GenerationInput with `random?`, GenerationOutput, PlannerWarning)
  - Created `lib/planner/gate.ts` (checkPreFlightGate — pure predicate, never throws)
  - Created `lib/planner/rules.ts` (hasFlavorCollision, wouldRepeat, pickNonRepeatDish)
  - Created `lib/planner/generate.ts` (generatePlan, PreFlightGateError, LUNCH_THREE_DISH_PROBABILITY)
  - Created `lib/planner/fixtures.ts` (5 fixture libraries: tooSmall, noSpecial, singleFlavor, barelySufficient, normal)
  - Created `lib/planner/generate.test.ts` (32 tests covering gate, special day, breakfast, lunch, shopping list, edge cases)
  - Verified: all tests pass ✓, typecheck ✓, build ✓
  - Fixed: special dish excluded from regular lunch candidates from start; weekend calculation uses actual startDate

- Phase 1: Prisma schema, migration, and client singleton
  - Created `prisma/schema.prisma` with Auth.js models + domain models
  - Created `prisma.config.ts` (Prisma 7 config format)
  - Created `.env` with `DATABASE_URL`
  - Created `lib/db.ts` (Prisma client singleton)
  - Ran initial migration against Neon (`20260627115619_init`)
  - Verified: migration status ✓, typecheck ✓, build ✓

- Phase 3: Dish Library
  - **3A — Data Layer:**
    - Created `lib/zod/ingredient.ts` (IngredientSchema)
    - Created `lib/zod/dish.ts` (DishSchema with Special/Breakfast refine, DishFilterSchema)
    - Created `app/actions/ingredients.ts` (getIngredients, createIngredient with case-insensitive reuse, updateIngredient with collision guard, deleteIngredient with active-dish guard)
    - Created `app/actions/dishes.ts` (getDishes, getDishById, createDish, updateDish with flavor dedupe, deleteDish soft-delete)
    - Verified: typecheck ✓, build ✓
  - **3B — Ingredient Management UI:**
    - Installed shadcn: sheet, command, popover
    - Created `components/ingredient-sheet.tsx` (slide-out drawer with add, inline rename, delete with AlertDialog confirmation)
    - Created `components/ingredient-combobox.tsx` (searchable multi-select with chip display, "Manage Ingredients" opens sheet, auto-sync via onChange)
    - Verified: typecheck ✓, build ✓
  - **3C — Dish CRUD UI:**
    - Installed shadcn: badge, select, dialog, alert-dialog
    - Created `components/category-badge.tsx`, `components/flavor-tag.tsx`, `components/dish-card.tsx`
    - Created `components/dish-dialog.tsx` (create/edit form with name, category, meal time, special toggle, flavors, ingredient combobox)
    - Created `components/delete-dish-dialog.tsx` (confirmation dialog)
    - Created `app/(dashboard)/dishes/dish-library.tsx` (responsive grid, category/meal time filters, debounced search)
    - Created `app/(dashboard)/dishes/page.tsx` (server component wrapper)
    - Created `app/(dashboard)/dishes/loading.tsx` (skeleton loader)
    - Fixed pre-existing build error: wrapped sign-in form in Suspense boundary
    - Verified: typecheck ✓, build ✓

- Phase 2: Auth + Layout Shell
  - **2A — Auth Core:**
    - Installed `next-auth` v4.24.14, `zod`, `bcryptjs`, `@prisma/adapter-neon`
    - Added `NEXTAUTH_SECRET`, `NEXTAUTH_URL` to `.env`
    - Created `types/next-auth.d.ts` (module augmentation for `Session.user.id`, `JWT.id`)
    - Created `lib/zod/auth.ts` (SignInSchema, SignUpSchema)
    - Normalized sign-in/sign-up `name` and `email` inputs with `trim()` before validation in `lib/zod/auth.ts`
    - Created `lib/auth.ts` (Auth.js v4 config — Credentials provider, JWT callbacks, no adapter)
    - Created `app/api/auth/[...nextauth]/route.ts` (Auth.js route handler)
    - Created `app/actions/auth.ts` (signup Server Action — user creation only)
    - Created `app/(auth)/layout.tsx` (minimal centered layout)
    - Created `app/(auth)/sign-in/page.tsx` + `sign-in-form.tsx`
    - Created `app/(auth)/sign-up/page.tsx` + `sign-up-form.tsx`
    - Created `proxy.ts` (route protection via `getToken()`)
    - Updated `lib/db.ts` to use `@prisma/adapter-neon` (required by Prisma 7)
    - Verified: typecheck ✓, build ✓
  - **2B — Layout Shell:**
    - Created `components/sidebar.tsx` (client component — desktop sidebar + mobile drawer)
    - Created `app/(dashboard)/layout.tsx` (server layout with sidebar)
    - Moved `app/page.tsx` → `app/(dashboard)/page.tsx` (greeting placeholder)
    - Verified: typecheck ✓, build ✓
  - **2C — Stability fixes from issues history:**
    - Updated `app/(dashboard)/layout.tsx` to redirect unauthenticated users to `/sign-in` instead of using a non-null session assertion
    - Updated `components/sidebar.tsx` with a mount gate for theme-dependent icon/label rendering to prevent hydration mismatches
    - Updated `components/theme-provider.tsx` to defer `next-themes` provider initialization until mount, avoiding initial script-tag render warnings

## Schema Changes from Feature Doc

- **User ↔ Account**: one-to-one (`Account.userId` is `@unique`)
- **No `emailVerified`**: email verification out of scope for v1
- **No `image`**: image upload out of scope for v1
- **No `VerificationToken`**: not needed without email verification
- **`Dish.category`**: `Category` enum (MAIN, SIDE, SOUP, SNACK, ACCOMPANIMENTS, OTHER) instead of freeform string
- **Prisma 7**: uses `prisma.config.ts` for datasource URL instead of `url` in schema

## Files Created in Phase 3

- `lib/zod/dish.ts`, `lib/zod/ingredient.ts`
- `app/actions/dishes.ts`, `app/actions/ingredients.ts`
- `components/ingredient-sheet.tsx`, `components/ingredient-combobox.tsx`
- `components/category-badge.tsx`, `components/flavor-tag.tsx`, `components/dish-card.tsx`
- `components/dish-dialog.tsx`, `components/delete-dish-dialog.tsx`
- `app/(dashboard)/dishes/page.tsx`, `dish-library.tsx`, `loading.tsx`
- shadcn: badge, select, dialog, alert-dialog, sheet, command, popover, textarea, input-group

## Files Created in Phase 5

- `prisma/schema.prisma` (modified — added `warnings Json` to MealPlan)
- `lib/utils/date.ts` — parseCalendarDate, formatCalendarDate, addDaysToCalendarDate
- `lib/zod/plan.ts` — GeneratePlanSchema
- `app/actions/plan.ts` — generatePlanAction, getCurrentPlan, getDishCounts
- `lib/planner/gate.ts` (modified — exported MIN_BREAKFAST_DISHES, MIN_LUNCH_DISHES)
- `app/(dashboard)/plan/page.tsx` — Plan page (server component)
- `components/generate-plan-form.tsx` — Generate plan form (client)
- `components/plan-view.tsx` — Plan view with day cards (client)
- `components/day-card.tsx` — Day card with breakfast/lunch rows
- `components/dish-pill.tsx` — Badge showing dish name + optional star
- `app/(dashboard)/page.tsx` (rewritten — Dashboard with greeting, banner, summary, links)

## Files Created in Phase 7

- `app/actions/plan.ts` (modified — extracted `findPlanWithWarnings`; added `getPlanById`, `getPlanHistory`)
- `components/plan-view.tsx` (modified — real `/history` link instead of placeholder text)
- `app/(dashboard)/history/page.tsx` — history list (cards, empty state)
- `app/(dashboard)/history/[planId]/page.tsx` — read-only plan detail view
- `lib/zod/auth.ts` (modified — extracted `PasswordSchema`)
- `lib/zod/settings.ts` — `UpdateNameSchema`, `UpdatePasswordSchema`
- `app/actions/settings.ts` — `updateNameAction`, `updatePasswordAction`
- `components/session-provider.tsx` — `"use client"` wrapper for `next-auth/react`'s `SessionProvider`
- `app/layout.tsx` (modified — mounted `SessionProvider`)
- `lib/auth.ts` (modified — `jwt` callback handles `trigger === "update"`)
- `app/(dashboard)/settings/page.tsx` — Account settings page
- `components/update-name-form.tsx` — Profile name form with session sync
- `components/update-password-form.tsx` — Password change form
- `components/sign-out-button.tsx` — Settings-page sign-out button
- `components/sidebar.tsx` (modified — added "Settings" nav entry)

## Files Created in Phase 4

- `lib/planner/types.ts` — PlannerDish, GenerationInput (incl. `random?`), GenerationOutput, PlannerWarning
- `lib/planner/gate.ts` — Pre-flight gate check (pure predicate)
- `lib/planner/rules.ts` — Flavor collision, repeat detection
- `lib/planner/generate.ts` — Main generation algorithm + PreFlightGateError
- `lib/planner/fixtures.ts` — 5 test fixture dish libraries
- `lib/planner/generate.test.ts` — 32 unit tests
- `vitest.config.ts` — Vitest configuration

## Bug Fixes

- **Dish card mobile actions + dish dialog UX bugs** (2026-07-09)
  - **Dish card Edit/Delete hidden on mobile**: `components/dish-card.tsx`
    revealed the Edit/Delete row only via `opacity-0 group-hover:opacity-100`,
    which never triggers on touch devices with no hover state — the buttons
    were effectively invisible on mobile. Fix: buttons are visible by default
    (`opacity-100`) and only fade in on hover at `md:` and above
    (`md:opacity-0 md:group-hover:opacity-100`), preserving the desktop
    hover-reveal affordance.
  - **Flavor changes silently dropped on Save**: `components/flavor-combobox.tsx`'s
    text input only committed typed text to the `flavors` array on Enter or
    the "Add" button — clicking Save (or anywhere else) with unconfirmed text
    still in the input discarded it with no warning, reported as "can't
    update the dish flavors." Confirmed create/edit/remove all persisted
    correctly through the combobox's own Add/Enter/suggestion-click paths;
    the bug was specifically uncommitted free-typed text. Fix: added
    `onBlur` on the input that commits (`addFlavor`) any non-empty trimmed
    text, so losing focus (e.g. clicking Save) no longer loses the flavor.
  - **Meal Time radio / Special dish checkbox not primary-colored**:
    `components/dish-dialog.tsx`'s native `<input type="radio">` /
    `<input type="checkbox">` used `accent-current` (follows text color)
    instead of the theme's primary token. Fix: switched both to
    `accent-primary` (maps to the existing `--color-primary` CSS variable),
    matching the "Add Dish" button and other primary-colored controls.
  - **Files changed**: `components/dish-card.tsx`,
    `components/flavor-combobox.tsx`, `components/dish-dialog.tsx`
  - Verified: typecheck ✓, vitest ✓ (67 tests, unaffected), manual browser
    walkthrough (mobile viewport shows Edit/Delete without hover; typed
    flavor + direct Save click now persists; radio/checkbox render in
    primary blue in both Create and Edit dialogs) — test flavors/values
    added during verification were removed afterward, dish data restored
    to its pre-test state.

- **Ingredient Sheet — scroll fix + search filter** (2026-06-28)
  - **File**: `components/ingredient-sheet.tsx`
  - **Changes**:
    - Fixed scroll issue: Changed outer container to `flex-1 overflow-hidden` so the ingredient list scrolls within the sheet's available height
    - Added search/filter: New `SearchIcon` input above the list with client-side filtering by ingredient name
    - Added empty state for no search matches: "No ingredients match your search."
    - Search resets when sheet opens
  - **Note**: The `getIngredients` server action already supports a `search` parameter, but client-side filtering was chosen for the sheet to avoid extra round-trips (typical user ingredient list is small)

- **IngredientCombobox — selected badges disappear while searching** (2026-06-28)
  - **Root cause**: `selectedIngredients` was derived from `ingredients` (the search-filtered API response), so any already-selected ingredient whose name didn't match the current query was excluded from the badge list.
  - **Fix**: Added `allIngredientsRef` (`useRef<Map<string, Ingredient>>`), a cumulative cache merged from every `fetchIngredients` response. `selectedIngredients` is now resolved from this full cache via `useMemo`, making the badge list immune to the active search query.
  - **File changed**: `components/ingredient-combobox.tsx`

- **Dish Library — pagination** (2026-06-28)
  - Added `page` / `pageSize` fields to `DishFilterSchema` (Zod); both default and coerce.
  - Updated `getDishes` to accept `page`/`pageSize`, run `prisma.dish.count` in parallel
    with `findMany` (skip/take), and return `{ total, page, pageSize, totalPages }` alongside `dishes`.
  - Updated `DishLibrary` client component: tracks `page` state; resets to 1 on any
    filter/search change; renders a prev/next pagination bar + page-of-total counter
    (hidden when ≤ 1 page); improved empty-state copy distinguishes "no dishes at all"
    from "no matches for current filters".
  - Updated `03-dish-library.md` (getDishes table, DishFilterSchema fields, acceptance
    criteria, deferred-features section).
  - Files changed: `lib/zod/dish.ts`, `app/actions/dishes.ts`,
    `app/(dashboard)/dishes/dish-library.tsx`,
    `.agents/context/features/03-dish-library.md`

- **Planner — local-timezone date arithmetic** (2026-06-30)
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

- **Dashboard — server-local greeting timezone** (2026-07-01)
  - **Root cause**: Dashboard greeting/date used `new Date()` in a server component, deriving time-of-day and formatted date from the server clock. Users in other timezones would see the wrong greeting and date.
  - **Fix**: extracted greeting into `components/greeting-header.tsx` (client component) that uses the browser's `Date` via `useMemo`, so greeting and date reflect the user's local timezone.
  - **File changed**: `components/greeting-header.tsx` (new), `app/(dashboard)/page.tsx`

- **Generate plan form — UTC date default/min** (2026-07-01)
  - **Root cause**: `getTodayStr()` in `components/generate-plan-form.tsx` used `getUTCFullYear/getUTCMonth/getUTCDate`, which for users ahead of UTC could yield tomorrow's date as the default and min for the date picker.
  - **Fix**: switched to local-time methods (`getFullYear/getMonth/getDate`) since the component is `"use client"` and runs in the browser. Planner's UTC-safe logic untouched.
  - **File changed**: `components/generate-plan-form.tsx`

- **Generate plan form — invalid duration preview** (2026-07-01)
  - **Root cause**: `durationValue` could become `0` or `NaN` when the number input is cleared, making `durationDays` invalid. `addDaysToCalendarDate` would receive bad input and the preview text would break.
  - **Fix**: clamped `durationDays` to ≥ 1 via `Math.max(1, Math.floor(...) || 1)`, guarded preview text rendering with conditional.
  - **File changed**: `components/generate-plan-form.tsx`

- **Plan view — non-functional "View past plans" button** (2026-07-01)
  - **Root cause**: "View past plans →" was a `<button>` with no `onClick` handler and no navigation target (no `/history` route exists). Styled with hover effects and arrow, implying interactivity.
  - **Fix**: replaced with a static `<p>` reading "History coming soon" — no hover effect, no cursor, no arrow, clearly non-interactive.
  - **File changed**: `components/plan-view.tsx`

- **Plan schema — semantic date validation** (2026-07-01)
  - **Root cause**: `startDate` in `GeneratePlanSchema` used a regex (`/^\d{4}-\d{2}-\d{2}$/`) that only checked format, not validity. Dates like `2026-02-30` would pass validation and fail later.
  - **Fix**: switched to `z.iso.date()` (Zod v4) which validates both ISO format and semantic calendar correctness.
  - **File changed**: `lib/zod/plan.ts`

- **Plan edit swap — selected dish not applied** (2026-07-01)
  - **Root cause**: `EditableDishPill` controlled the shadcn/Radix `Select` with `open` + `onOpenChange={setEditing}` while also unmounting the component when edit mode closes. On selection, close events could end edit mode before value-change mutation handling completed reliably.
  - **Fix**: switched to `defaultOpen` (uncontrolled open state), removed the debug `console.log`, and kept edit-mode teardown in `onOpenChange` only when the popover fully closes.
  - **File changed**: `components/editable-dish-pill.tsx`

- **History detail page — crash rendering plan-level warnings** (2026-07-02)
  - **Root cause**: `MealPlan.warnings` is stored as `{ code, message }[]`
    (see `generatePlanAction`), but the new
    `app/(dashboard)/history/[planId]/page.tsx` cast it straight to
    `string[]` and passed the raw objects into `buildWarningCards` →
    React tried to render `{code, message}` objects as JSX children,
    crashing the page ("Objects are not valid as a React child").
    `components/plan-view.tsx` already had the correct
    `typeof warning === "string" ? warning : warning.message` mapping;
    the history page was written without reusing it. Caught during
    manual browser verification, not by typecheck (the cast suppressed
    the type error) or by vitest (no test covers page-level rendering).
  - **Fix**: applied the same string/object normalization used in
    `plan-view.tsx` before passing warnings into `buildWarningCards`.
  - **File changed**: `app/(dashboard)/history/[planId]/page.tsx`

- **Special Day cadence — weekly instead of biweekly** (2026-07-04)
  - **Root cause**: not a bug — a product rule change. `buildWindowInfos`
    in `lib/planner/generate.ts` chunked the plan into 14-day windows and
    placed one Special Day per window, i.e. once every two weeks. The
    single-dish and weekend-only rules were already correct; only the
    cadence needed to change to once per week.
  - **Fix**: changed the window chunk size from 14 to 7 days
    (`wStart += 7`, `wLen = Math.min(7, ...)`) — every other part of the
    algorithm (weekend detection, one-offset-per-window pick, single-dish
    special lunch, exclusion of the special dish from the regular pool)
    was already window-size-agnostic and needed no change.
  - **Files changed**: `lib/planner/generate.ts`,
    `lib/planner/generate.test.ts` (updated hardcoded special-day counts
    for 7/14/20/28-day durations to match the new weekly cadence),
    `.agents/context/project-overview.md` (updated the "once per 2-week
    cycle" feature bullet to "once per week")

- **Special Day — extra Special-flagged dishes leaked into regular lunches** (2026-07-04)
  - **Root cause**: `generatePlan` reserves the *first* `isSpecial` Lunch
    dish for the Special day (`lunchDishes.find((d) => d.isSpecial)`), but
    `regularLunchPool` excluded only that one reserved dish
    (`filter((d) => d.id !== specialDish.id)`). Any *other* Special-flagged
    dish stayed in the regular Main/Side/compensatory pool and could be
    served on an ordinary weekday. Because `lib/utils/plan-grouping.ts`
    derives a day's `isSpecialDay` from whether any of its dishes has
    `dish.isSpecial`, that leaked dish made a regular weekday render a
    second, bogus "Special day" badge — with 2–3 dishes, violating both
    "one special day per week" and "one dish per special day". Reproduced
    on the Villa Myo account (library has ≥2 `isSpecial` Lunch dishes):
    weekdays showed a false Special day alongside the real weekend one.
  - **Fix**: `regularLunchPool = lunchDishes.filter((d) => !d.isSpecial)`
    — reserve *every* Special-flagged dish for the Special day, so none can
    fill a regular Main/Side/compensatory slot. With no special dish in a
    regular lunch, `plan-grouping.ts`'s `isSpecialDay` derivation becomes
    exact (true iff it's the real Special day) with no UI change needed.
    Also hardened `lib/planner/gate.ts` to count only *non-special*
    Mains/Side-or-Soups, so a library whose only Main/Side is Special-
    flagged is blocked at the gate instead of crashing generation with an
    empty regular pool.
  - **Files changed**: `lib/planner/generate.ts`, `lib/planner/gate.ts`,
    `lib/planner/generate.test.ts` (added a gate test for an all-Special
    Main, and a generation test proving a 2-special-dish library yields one
    single-dish Special day per week with no leak). Verified end to end:
    regenerated a 21-day plan on the Villa Myo account → Special days land
    only on Sat Jul 4 / Sun Jul 12 / Sun Jul 19, one dish each, no weekday
    Special badge (DB + UI confirmed).

- **SessionProvider breaking static generation** (2026-07-02)
  - **Root cause**: `next-auth` v4's `react/index.js` has no
    `"use client"` directive. Importing `SessionProvider` directly into
    `app/layout.tsx` (a Server Component) and rendering it built fine
    under `next dev` but failed `next build`'s static generation of
    `/_not-found` with "React Context is unavailable in Server
    Components."
  - **Fix**: added `components/session-provider.tsx`, a one-line
    `"use client"` re-export of `SessionProvider` — the same wrapper
    pattern `components/theme-provider.tsx` already uses for
    `next-themes`. `app/layout.tsx` imports from the wrapper instead of
    `next-auth/react` directly.
  - **File changed**: `components/session-provider.tsx` (new),
    `app/layout.tsx`

## Files Created/Modified in Phase 8

- `prisma/schema.prisma` (modified — `DishPairing` model + `Dish` relations)
- `prisma/migrations/20260703000000_add_dish_pairing/migration.sql` (new)
- `lib/zod/dish.ts` (modified — `pairedDishIds` on `DishSchema`)
- `app/actions/dishes.ts` (modified — `syncDishPairings`, `dishInclude`,
  `withPairedDishes`, `PairingValidationError`, transactional create/update)
- `lib/planner/types.ts` (modified — `Category`, `pairedDishIds`,
  `NO_PAIRED_DISH_FALLBACK`)
- `lib/planner/gate.ts` (modified — `MIN_MAIN_DISHES`, `MIN_SIDE_OR_SOUP_DISHES`)
- `lib/planner/rules.ts` (modified — `sharesFlavor`, `pickPairedSideOrSoup`,
  `pickCompensatoryDish`)
- `lib/planner/generate.ts` (rewritten — Lunch assignment,
  `MAIN_SIDE_SAME_FLAVOR_PROBABILITY`)
- `lib/planner/fixtures.ts` (modified — 7 new fixtures, `category`/
  `pairedDishIds` added to all existing ones)
- `lib/planner/generate.test.ts` (rewritten — 64 tests)
- `components/dish-pairing-combobox.tsx` (new)
- `components/dish-dialog.tsx` (modified — wired pairing combobox)
- `components/dish-card.tsx` (modified — "Paired with" line)
- `app/actions/plan.ts` (modified — `generatePlanAction` input mapping,
  `getDishCounts` per-category counts)
- `app/(dashboard)/page.tsx` (modified — new gate banner messages)

## In Progress

- None (Phase 8 complete — all planned phases done)

## Next Up

- None planned.

## Open Questions

- None.

## Architecture Decisions

- **Prisma 7 config**: `prisma.config.ts` holds `DATABASE_URL`; `schema.prisma` datasource block has no `url` property
- **Prisma 7 client**: requires `@prisma/adapter-neon` driver adapter — `new PrismaClient({ adapter })` instead of bare `new PrismaClient()`
- **One-to-one User/Account**: `Account.userId @unique` enforces single account per user at DB level
- **Category enum**: enforced at DB level via Prisma enum, not freeform string
- **Auth.js v4**: no unified `auth()`/server-callable `signIn()` — signup Server Action creates user only, client calls `signIn()` separately
- **Route protection**: `proxy.ts` (Next.js 16 convention) with `getToken()` from `next-auth/jwt`

## Session Notes

- Neon project: `my-meal-db` (`frosty-sky-56033851`), branch: `production` (`br-floral-wind-aohzf9ww`)
- `.env` contains `DATABASE_URL` with pooler endpoint
- `pnpm.onlyBuiltDependencies` in `package.json` for prisma build scripts
