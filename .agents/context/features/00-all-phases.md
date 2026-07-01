# All Phases — Development Order

## Overview

Incremental build of "My Meal" — a weekly meal planner and shopping list web app. Each phase is independently verifiable and doesn't break previous phases.

**Stack:** Next.js (App Router) + TypeScript, Prisma + PostgreSQL (Neon), Auth.js (Credentials), Tailwind + shadcn/ui

---

## Phase 1 — Foundation: Prisma

**Goal:** Initialize Prisma with the full database schema, run the initial migration against Neon, create the Prisma client singleton.

**Deliverable:** Database ready with all tables created.

**Plan:** `.agents/context/features/01-phase-1-foundation.md`

---

## Phase 2 — Auth + Layout Shell

**Goal:** Set up Auth.js with Credentials provider, build sign-in/sign-up pages, and create the app layout shell with sidebar navigation.

**Deliverable:** Working auth flow (sign up, sign in, sign out) with a basic app shell.

**Plan:** `.agents/context/features/02-auth-and-layout.md`

---

## Phase 3 — Dish Library

**Goal:** Build the dish CRUD system with ingredient management — the single source of truth for the planner.

**Deliverable:** Full dish library management (create, edit, archive dishes; manage ingredients inline).

**Plan:** `.agents/context/features/03-dish-library.md`

---

## Phase 4 — Planner Core (Pure Logic, No UI)

**Goal:** Implement the meal plan generation algorithm and rule-checking functions as pure, framework-free TypeScript — fully testable in isolation.

**Deliverable:** Tested generation algorithm that enforces all balance rules.

**Plan:** `.agents/context/features/04-planner-core.md`

---

## Phase 5 — Plan Generation + Dashboard

**Goal:** Wire the planner algorithm to the database via Server Actions, build the Dashboard with plan generation and viewing.

**Deliverable:** Generate plans from the dashboard, view them with day cards and dish pills.

**Plan:** `.agents/context/features/05-plan-generation-and-dashboard.md`

---

## Phase 6 — Plan Editing + Shopping List

**Goal:** Allow manual per-slot dish swaps and build the deduplicated shopping list with check-off functionality.

**Deliverable:** Edit plan slots, see warnings on rule violations, check off shopping items.

---

## Phase 7 — History + Account Settings + Polish

**Goal:** Complete the app with plan history browsing, account settings, and the dashboard blocking banner.

**Deliverable:** Full app with all features working end to end.

---

## Phase Summary

| Phase | Scope | Key Deliverable | Dependencies |
|---|---|---|---|
| **1** | Prisma schema + migrations + client singleton | Database ready | None |
| **2** | Auth.js + sign-in/sign-up pages + layout shell | Working auth flow | Phase 1 |
| **3** | Dish library (CRUD, ingredients, pages) | Dish management | Phase 2 |
| **4** | Planner core (pure logic + unit tests) | Generation algorithm | None (pure TS) |
| **5** | Plan generation + Dashboard | Generate and view plans | Phases 2, 3, 4 |
| **6** | Plan editing + Shopping list | Edit slots, check off groceries | Phase 5 |
| **7** | History + Account settings + Polish | Full app complete | Phase 6 |

---

## Verification Checklist (Per Phase)

Before moving to the next phase:
1. Current unit works end to end within its defined scope
2. No invariant from `architecture.md` violated
3. `progress-tracker.md` updated
4. `npm run build` passes
5. `npm run typecheck` passes
6. If the phase touches `lib/planner/`, its unit tests pass in isolation
