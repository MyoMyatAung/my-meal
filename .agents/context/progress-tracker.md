# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Phase 2 — Auth + Layout Shell: In Progress

## Current Goal

- Phase 2: Auth.js + sign-in/sign-up pages + layout shell

## Completed

- Phase 1: Prisma schema, migration, and client singleton
  - Created `prisma/schema.prisma` with Auth.js models + domain models
  - Created `prisma.config.ts` (Prisma 7 config format)
  - Created `.env` with `DATABASE_URL`
  - Created `lib/db.ts` (Prisma client singleton)
  - Ran initial migration against Neon (`20260627115619_init`)
  - Verified: migration status ✓, typecheck ✓, build ✓

## Schema Changes from Feature Doc

- **User ↔ Account**: one-to-one (`Account.userId` is `@unique`)
- **No `emailVerified`**: email verification out of scope for v1
- **No `image`**: image upload out of scope for v1
- **No `VerificationToken`**: not needed without email verification
- **`Dish.category`**: `Category` enum (MAIN, SIDE, SOUP, SNACK, ACCOMPANIMENTS, OTHER) instead of freeform string
- **Prisma 7**: uses `prisma.config.ts` for datasource URL instead of `url` in schema

## In Progress

- Phase 2 plan written to `.agents/context/features/02-auth-and-layout.md`
- Awaiting implementation

## Next Up

- Phase 2 implementation: install deps → auth config → auth pages → proxy → sidebar → layout

## Open Questions

- None yet.

## Architecture Decisions

- **Prisma 7 config**: `prisma.config.ts` holds `DATABASE_URL`; `schema.prisma` datasource block has no `url` property
- **One-to-one User/Account**: `Account.userId @unique` enforces single account per user at DB level
- **Category enum**: enforced at DB level via Prisma enum, not freeform string

## Session Notes

- Neon project: `my-meal-db` (`frosty-sky-56033851`), branch: `production` (`br-floral-wind-aohzf9ww`)
- `.env` contains `DATABASE_URL` with pooler endpoint
- `pnpm.onlyBuiltDependencies` in `package.json` for prisma build scripts
