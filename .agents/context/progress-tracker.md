# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Phase 4 — Planner Core: Completed

## Current Goal

- Phase 5 — Plan Generation Server Action + UI (next)

## Completed

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

## Files Created in Phase 4

- `lib/planner/types.ts` — PlannerDish, GenerationInput (incl. `random?`), GenerationOutput, PlannerWarning
- `lib/planner/gate.ts` — Pre-flight gate check (pure predicate)
- `lib/planner/rules.ts` — Flavor collision, repeat detection
- `lib/planner/generate.ts` — Main generation algorithm + PreFlightGateError
- `lib/planner/fixtures.ts` — 5 test fixture dish libraries
- `lib/planner/generate.test.ts` — 32 unit tests
- `vitest.config.ts` — Vitest configuration

## Bug Fixes

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

- **`IngredientCombobox` — selected badges disappear while searching** (2026-06-28)
  - **Root cause**: `selectedIngredients` was derived from `ingredients` (the search-filtered API response), so any already-selected ingredient whose name didn't match the current query was excluded from the badge list.
  - **Fix**: Added `allIngredientsRef` (`useRef<Map<string, Ingredient>>`), a cumulative cache merged from every `fetchIngredients` response. `selectedIngredients` is now resolved from this full cache via `useMemo`, making the badge list immune to the active search query.
  - **File changed**: `components/ingredient-combobox.tsx`

## In Progress

- None (Phase 4 complete)

## Next Up

- Phase 5: Plan Generation Server Action + UI

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
