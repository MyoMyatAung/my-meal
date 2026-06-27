# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Next.js (App Router) + TypeScript project scaffolded. Six context
  files (`project-overview.md`, `architecture.md`, `ui-context.md`,
  `code-standards.md`, `ai-workflow-rules.md`, this file) finalized.
  `AGENTS.md` still needs its project summary/stack/commands filled
  in (see Session Notes). No feature implementation (dishes, plan,
  shopping list, auth) started yet.

## Current Goal

- Finalize the seven context files, then scaffold the Next.js
  project, the Prisma schema, and the planner module.

## Completed

- Static HTML/CSS click-through prototype (9 pages) — UX/flow
  reference only, not a pixel target (see `ui-context.md`)
- Product spec (`meal-planner-spec.md`) finalized
- All six context files finalized: `project-overview.md`,
  `architecture.md`, `ui-context.md`, `code-standards.md`,
  `ai-workflow-rules.md`, this file
- Next.js (App Router) + TypeScript project scaffolded

## In Progress

- None.

## Next Up

1. Write `prisma/schema.prisma` from `meal-planner-spec.md` §3
2. Build `lib/planner/` (pure generation + rule-checking functions)
   with fixture-based unit tests — before any UI calls it
3. Auth.js Credentials provider setup (`app/(auth)/`)
4. Dish library CRUD (`app/dishes/`)
5. Plan generation, view, and edit screens (`app/plan/`)
6. Shopping list checklist (`app/shopping-list/`)
7. Plan history
8. Account settings modal (username + email — see Architecture
   Decisions; confirm whether change-password/sign-out also live here)

## Open Questions

- **Dashboard "not enough dishes" blocking banner** — wording and
  layout still undecided (`ui-context.md`, Open UI States;
  `architecture.md`, Invariant 6).
- **`--destructive-foreground` contrast** — not blocking; current
  values are a reasoned first pass, to be confirmed visually once the
  shadcn `Button` is actually rendered in both themes.
- **Account settings modal scope** — confirmed as a single modal
  showing username and email (see Architecture Decisions). Not yet
  confirmed whether change-password and sign-out (both named in
  `project-overview.md`'s scope) live in that same modal or elsewhere.

## Architecture Decisions

- **2026-06-27** — Hosting locked to Neon only (dropped the
  Neon-or-Supabase either/or from the original draft) —
  `architecture.md`, Stack.
- **2026-06-27** — The real `app/globals.css` (shadcn preset
  `b1t52Uvx2`) is the canonical source for design tokens, superseding
  the static prototype's `styles.css`. Components are default
  shadcn/ui as installed, with no custom restyling pass and no
  prototype-to-shadcn mapping table — `ui-context.md`.
- **2026-06-27** — Radius locked to `0` (sharp corners) despite
  shadcn's rounded default in the generated theme — `globals.css`,
  `ui-context.md`.
- **2026-06-27** — Added `--destructive-foreground` to the theme
  (absent from the original shadcn-generated `globals.css`); values
  differ between light and dark mode because `--destructive` itself
  flips lightness between the two — `globals.css`, `ui-context.md`.
- **2026-06-27** — Account settings v1 is a single modal (not a
  dedicated page) showing username and email — `ui-context.md`, Open
  UI States.
- **2026-06-27** — Font family confirmed as Inter, loaded via
  `next/font` in `app/layout.tsx` — `ui-context.md`, Typography.

## Session Notes

- The Next.js + TypeScript scaffold already exists — check its actual
  structure before assuming a greenfield `app/` layout; reconcile any
  drift against `architecture.md`'s System Boundaries rather than
  overwriting what's already there.
- Context-file review happened file-by-file via uploaded drafts and
  inline review comments, not as one batch.
- `AGENTS.md` is the chosen agent entry-point filename (not
  `CLAUDE.md`). For Claude Code specifically to pick it up natively,
  a one-line `CLAUDE.md` containing `@AGENTS.md` still needs to be
  added — flagged earlier, not yet done.
- `AGENTS.md` itself currently contains only the Next.js
  training-data warning — it still needs the project summary, stack
  table, key commands, and pointers to the other context files
  before it can function as a real entry point.