# AI Workflow Rules

## Approach

Build this project incrementally using a spec-driven workflow.
`project-overview.md`, `architecture.md`, `ui-context.md`, and
`code-standards.md` define what to build and how to build it;
`progress-tracker.md` defines where things currently stand. Always
implement against `meal-planner-spec.md` and these context files —
do not infer or invent product behavior from scratch. `AGENTS.md`
governs framework-version caveats (Next.js conventions that may
differ from training data) and should be checked before writing any
code that touches framework APIs.

## Scoping Rules

- Work on one feature unit at a time
- Prefer small, verifiable increments over large
  speculative changes
- Do not combine unrelated system boundaries in a
  single implementation step

## When to Split Work

Split an implementation step if it combines:

- UI changes and the Server Action(s) behind them — implement and
  verify the action first (it's independently testable), then wire
  the form/page to it as a separate step
- Changes across more than one of `app/dishes/`, `app/plan/`,
  `app/shopping-list/`, or `app/(auth)/` — these are separate units
  even when a feature touches more than one conceptually
- `lib/planner/` logic and its UI consumer — the planner must be
  built and unit-tested against fixtures (see `code-standards.md`)
  before any screen or Server Action calls it
- Behavior not clearly defined in the context files — most notably
  the two UI states `ui-context.md` flags as not yet designed
  (Account settings, the Dashboard low-library banner). Resolve the
  design first; don't improvise it mid-implementation.

If a change cannot be verified end to end quickly,
the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the
  context files
- If a requirement is ambiguous, resolve it in the
  relevant context file before implementing
- If a requirement is missing, add it as an open question
  in `progress-tracker.md` before continuing

## Protected Files

Do not modify the following unless explicitly instructed:

- `components/ui/*` — shadcn-generated components. If one needs to
  change, re-run the shadcn CLI add/update rather than hand-editing
  the generated file, so it stays reproducible.
- `prisma/schema.prisma` — confirm before any change. A schema edit
  implies a migration, and migrations are expensive to undo once
  there's real data behind them.
- The token block in `app/globals.css` (`:root`, `.dark`, `@theme
  inline`) — these are owned by `ui-context.md`'s source-of-truth
  section. Don't hand-tune a color or the radius mid-feature; flag
  it and update both files together.

## Keeping Docs in Sync

Update the relevant context file whenever implementation
changes:

- System architecture or boundaries
- Storage model decisions
- Code conventions or standards
- Feature scope

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope
2. No invariant defined in `architecture.md` was violated
3. `progress-tracker.md` reflects the completed work
4. `npm run build` passes
5. `npm run typecheck` passes
6. If the unit touches `lib/planner/`, its unit tests pass in
   isolation — before anything in `app/` is wired to it