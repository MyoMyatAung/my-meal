# Architecture Context

## Stack

| Layer      | Technology                              | Role                                                                                          |
| ---------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Framework  | Next.js (App Router) + TypeScript        | Single codebase for frontend and backend; Server Components for reads, Server Actions for mutations |
| UI         | Tailwind CSS + shadcn/ui                 | Component layer; design tokens carry over from the validated static prototype — see `ui-context.md` |
| Auth       | Auth.js (NextAuth), Credentials provider | Email/password only; session is the sole access-control mechanism                              |
| Database   | PostgreSQL via Prisma                    | The only persistent store in v1 — see Data Storage below                                       |
| Validation | Zod                                      | Validates every Server Action's input at the boundary before any logic runs                    |
| Hosting    | Vercel (app) + Neon (Postgres)           | Deployment target                                                                             |

## System Boundaries

- `app/(auth)/` — sign-in / sign-up pages and their Server Actions.
  Owns the forms only; session creation and verification is delegated
  to Auth.js.
- `app/dishes/` — dish library pages (list, add, edit).
- `app/plan/` — generate, view, and edit screens for the active plan.
- `app/shopping-list/` — checklist view for the active plan's
  shopping list, including checked-state toggling.
- `app/actions/` — every Server Action (mutations and the queries
  that back them). This is the **only** layer outside `lib/db.ts`
  allowed to import `@prisma/client` directly.
- `lib/planner/` — the generation algorithm and the rule-checking
  functions (flavor uniqueness, no-repeat, special-day placement)
  reused by both generation and manual-edit validation. Pure,
  framework-free TypeScript — no imports from `next` or
  `@prisma/client`. Tested standalone with fixture dish libraries
  before it is wired to anything.
- `lib/db.ts` — the Prisma client singleton. `new PrismaClient()` is
  called exactly once, here.
- `prisma/` — schema and migrations.

## Data Storage

- **PostgreSQL via Prisma is the only persistent store in v1.** Users,
  dishes, ingredients, plans, plan entries, dish-entry links, and
  shopping list items (including checked state) all live in the
  relational schema — see `meal-planner-spec.md` §3 for the current
  model.
- There is no blob/file storage layer. Nothing in v1 generates or
  stores media, uploads, or large binary artifacts. If that changes
  later (e.g. recipe photos), add a row to this section *before*
  implementing it — don't introduce a storage layer implicitly.

## Auth and Access Model

- Every user authenticates via Auth.js Credentials (email/password).
  There are no anonymous or public routes beyond sign-in and sign-up.
- Every domain row — `Dish`, `Ingredient`, `My Meal`,
  `My MealEntry`, `My MealEntryDish`, `ShoppingListItem` — is scoped
  to exactly one `User`, directly or transitively, via `userId`.
- Ownership is total and non-shared: there is no collaboration, no
  shared libraries, and no shared plans between users in v1.
- Every Server Action that reads or writes a domain row must filter
  by `session.user.id`. There is no resource-level ACL beyond "is
  this row mine."

## Invariants

1. `lib/planner/*` has zero imports from `next`, `next-auth`, or
   `@prisma/client`. It only operates on plain TypeScript types passed
   in by its caller, and is fully testable in isolation with
   in-memory fixtures.
2. Dish deletion is always soft (`isArchived = true`). A
   `My MealEntryDish` referencing an archived dish must continue to
   resolve and render correctly in Plan History — never a broken or
   missing reference.
3. A plan's shopping list is a snapshot taken at generation time
   (`ShoppingListItem` rows tied to that `My Meal`), not a live
   recomputation from the current dish library. Editing or archiving
   a dish later must never retroactively change a past plan's
   shopping list.
4. Plan generation (and regeneration) writes its `My Meal`, all of
   its `My MealEntry` / `My MealEntryDish` rows, and its
   `ShoppingListItem` rows as a single Prisma transaction. A failure
   partway through must leave no partial plan behind.
5. Regeneration always replaces the entire plan — there is no partial
   or per-day regeneration. Manual edit (`app/plan/edit`) is the only
   mechanism for fine-grained, per-slot changes, and it does not
   enforce the balance rules: it surfaces a non-blocking warning and
   still saves.
6. Generation has exactly one hard gate — at least 1 Breakfast dish
   and 2 Lunch dishes in the library — which blocks the action
   entirely and is surfaced on the Dashboard, not the Generate screen.
   Everything short of that gate is a soft constraint that
   auto-relaxes with a named warning; it never fails silently and
   never blocks.