## Application Building Context — Meal Planner

**Project**: Weekly Meal Planner & Shopping List Web App  
**Stack**: Next.js (App Router) + TypeScript, Prisma + PostgreSQL, Auth.js (Credentials), Tailwind + shadcn/ui

Read the following files **in order** before implementing or making any architectural decision:

1. `.agent/context/project-overview.md` — product definition, goals, features, and scope
2. `.agent/context/architecture.md` — system structure, boundaries, storage model, and invariants
3. `.agent/context/ui-context.md` — theme, colors, typography, and component conventions
4. `.agent/context/code-standards.md` — implementation rules and conventions
5. `.agent/context/ai-workflow-rules.md` — development workflow, scoping rules, and delivery approach
6. `.agent/context/progress-tracker.md` — current phase, completed work, open questions, and next steps

**Always** cross-reference `MEAL_PLANNER_SPEC.md` and the static prototype for UI/flow intent.

Update `.agent/context/progress-tracker.md` after each meaningful implementation change.

If implementation changes the architecture, scope, UI conventions, or standards documented in the context files, update the relevant file **before** continuing.

<!-- BEGIN:nextjs-agent-rules -->
## Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.
<!-- END:nextjs-agent-rules -->

## Key Commands

- `npm run dev` — development server
- `npm run build` — production build check
- `npm run typecheck` — TypeScript check
- `npx prisma generate` / `npx prisma migrate dev` — database
- `npx vitest` — run planner unit tests

## Important Reminders for this Project

- `lib/planner/` must remain pure (no DB, no Next.js imports).
- Prioritize fidelity to the prototype's layout (sidebar, day-cards, dish-pills).
- Generation must pass hard pre-flight gate (1 Breakfast + 2 Lunch dishes).
- Soft-delete for dishes; snapshot behavior for historical plans.