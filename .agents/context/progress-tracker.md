# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Phase 2 — Auth + Layout Shell: Completed

## Current Goal

- Phase 3 — Dish Library (next)

## Completed

- Phase 1: Prisma schema, migration, and client singleton
  - Created `prisma/schema.prisma` with Auth.js models + domain models
  - Created `prisma.config.ts` (Prisma 7 config format)
  - Created `.env` with `DATABASE_URL`
  - Created `lib/db.ts` (Prisma client singleton)
  - Ran initial migration against Neon (`20260627115619_init`)
  - Verified: migration status ✓, typecheck ✓, build ✓

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

## In Progress

- None (Phase 2 complete)

## Next Up

- Phase 3: Dish Library (CRUD, soft-delete, combobox ingredient input)

## Open Questions

- None yet.

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
