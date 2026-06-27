# Code Standards

## General

- Keep modules small and single-purpose
- Fix root causes, do not layer workarounds
- Do not mix unrelated concerns in one component or route
- Prefer composition over premature abstraction — don't build a
  generic "rule engine" before there are at least two concrete rules
  that actually need one

## TypeScript

- Strict mode is required throughout the project
- Avoid `any` — use explicit interfaces or narrowly
  scoped types
- Validate unknown external input (form data, query params, Server
  Action arguments) with Zod at the boundary before trusting it
- `lib/planner/*` types are the contract between the generation
  algorithm and everything that calls it — define each shape once
  there and import it elsewhere; don't redeclare an equivalent type
  ad hoc in a route or component file

## Next.js

- Default to Server Components
- Add `"use client"` only when browser interactivity requires it
  (form state, the meal-time/flavor toggles, drag-and-drop-style
  dish-slot editing)
- Mutations go through Server Actions in `app/actions/` — not
  client-side `fetch` calls to a route handler
- Keep each Server Action focused on a single responsibility — one
  action per mutation, not a multi-purpose dispatcher keyed off an
  action-type argument

## Styling

- Use the CSS custom property tokens defined in `globals.css` / 
  `ui-context.md` — no hardcoded hex values
- `--radius` is `0` everywhere — never add a `rounded-*` Tailwind
  utility class
- Use default shadcn/ui components as installed via the CLI; if a
  component needs to diverge from its shadcn default, that's a
  flagged design decision (recorded in `ui-context.md`), not a
  silent one-off override

## Server Actions

- Validate and parse input with Zod before any logic runs
- Every action scopes its query or mutation to `session.user.id` —
  no action may omit this filter (see `architecture.md`, Auth and
  Access Model)
- Return a consistent, predictable shape — e.g.
  `{ success: true, data } | { success: false, error }` — never let
  a raw Prisma error reach the client
- The one exception to "Server Actions, not route handlers" is the
  NextAuth catch-all route (`app/api/auth/[...nextauth]/route.ts`),
  which Auth.js requires as a route handler

## Testing

- Test runner: Vitest
- `lib/planner/*` is unit-tested in isolation, against fixture dish
  libraries, **before** it's wired to any Server Action or UI — this
  is the one part of the codebase that needs tests before a unit
  counts as done, not after
- Required fixtures (per `meal-planner-spec.md` §4): a library too
  small to pass the pre-flight gate; a library with no Special-
  flagged dish; a single-flavor library (forces a flavor-uniqueness
  relaxation); a library just barely large enough to avoid a repeat
  across the full period
- Test files live alongside their source (`lib/planner/generate.test.ts`),
  not in a separate top-level `__tests__/` tree

## Data and Storage

- PostgreSQL via Prisma is the only persistent store — see
  `architecture.md`, Data Storage
- Plan generation (and regeneration) is one Prisma transaction: the
  `MealPlan`, every `MealPlanEntry` / `MealPlanEntryDish`, and every
  `ShoppingListItem` it produces are written together or not at all —
  never as separate sequential `create` calls that could partially
  fail
- Dish deletion is always soft (`isArchived = true`) — never a hard
  `delete()` on a `Dish` row, since a `MealPlanEntryDish` may still
  reference it from a past plan

## File Organization

- `app/(auth)/` — sign-in / sign-up pages and their Server Actions
- `app/dishes/` — dish library pages (list, add, edit)
- `app/plan/` — generate, view, and edit screens for the active plan
- `app/shopping-list/` — checklist view for the active plan
- `app/actions/` — all Server Actions and the queries that back them
- `lib/planner/` — pure generation + rule-checking functions and
  their unit tests
- `lib/db.ts` — the Prisma client singleton
- `prisma/` — schema and migrations