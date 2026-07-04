# My Meal

## Overview

My Meal is a multi-user web app for weekly meal planning and shopping.
Each user maintains a private library of dishes (recipes) tagged with
category, flavor, meal time, and ingredients. From that library, the
app randomly generates a meal plan for a user-chosen date range —
enforcing flavor balance per lunch, no dish repeats within any 7-day
block, and a once-a-week "Special Day" — then aggregates every
ingredient in the plan into a single deduplicated shopping list the
user can check off while shopping.

## Goals

1. Replace manual weekly meal planning with an automated generator
   that reliably satisfies a defined set of balance rules, and is
   honest — via visible warnings — on the rare occasions it has to
   relax one.
2. Make the dish library the single source of truth, so a user only
   ever enters a recipe once, and both the planner and the shopping
   list derive from it.
3. Turn a generated plan directly into a usable, checkable grocery
   list with zero manual aggregation.

## Core User Flows

There isn't one linear onboarding path — the app is built around a
few recurring loops:

1. **Library loop** — add, edit, or archive dishes as the user's
   regular recipes change, including linking a Lunch dish to the other
   Lunch dishes it's usually served with.
2. **Pairing loop** — from any Lunch dish's entry in the library, pick
   the other Lunch dishes it naturally goes with. The relationship is
   mutual — pairing Dish A to Dish B also shows Dish B as paired to A,
   with no second edit required.
3. **Planning loop** (the primary loop) — set a start date and
   duration → generate a plan → view it → use the generated shopping
   list while shopping → check items off. Generation draws on the
   user's pairings when choosing each lunch's Side dish or Soup.
4. **Editing loop** — open an existing plan and swap an individual
   dish in a specific slot, without regenerating the whole period.
   Pairing has no effect here — a swap still offers every dish of the
   same meal time.
5. **Review loop** — browse past plans and their shopping lists.

## Features

### Dish Library

- Create, edit, and archive (soft-delete) dishes
- Fields: name, category, flavor(s) (multi-select), ingredients, meal
  time (Breakfast or Lunch — exclusive), special flag
- Ingredients are chosen from a per-user master ingredient list
  (search-or-create inline) — never free text — so the shopping list
  can dedupe reliably
- Archiving a dish removes it from future generation but does not
  change how it displays in any plan that already references it

### Dish Pairing

- From a Lunch dish's form, a user can select any number of other
  Lunch dishes as "paired" with it — any category can pair with any
  other (a Main with a Side, a Main with a Soup, a Side with an
  Accompaniment, and so on)
- Pairing is always mutual: pairing Dish A to Dish B also pairs Dish B
  to Dish A, with no separate step required on B's side
- Breakfast dishes can't be paired — breakfast is always a single
  dish, so a pairing on one would never be used
- Pairing is optional; a dish with no pairings still generates
  normally, via the flavor-based fallback described below

### Meal Plan Generation

- User sets start date and duration (default 14 days; any number of
  days/weeks)
- Breakfast: 1 dish/day, no flavor rule, no repeats within any 7-day
  block (same weekly window as Lunch)
- Lunch: a mandatory Main course, a mandatory Side dish or Soup, and
  an optional third dish (Snack, Accompaniment, or Other) — 2–3
  dishes/day. The Side dish or Soup is chosen from the Main's paired
  dishes when any exist; a Main with no pairings still produces a
  complete, valid lunch via the prior flavor-based pick
- Flavors are distinct across a lunch's dishes, with one deliberate,
  occasional exception: a Main and its paired Side/Soup are allowed to
  share a flavor about 3 times in 10, reflecting that real
  well-paired dishes often do. This is always surfaced as a visible
  warning, whether the overlap was the deliberate roll or a forced
  relaxation (no flavor-clean paired option existed). When a collision
  occurs, an optional third dish — flavor-distinct from both, and
  preferring one paired to both the Main and the Side/Soup — may be
  added
- No dish repeats within any 7-day block of the plan, for both Lunch
  and Breakfast — a dish used in one week can't reappear that same week
  but can reappear the week after. When the library has fewer
  breakfasts than a week is long, the generator round-robins the pool
  so forced repeats are spread evenly across the period rather than
  landing on consecutive days
- Exactly one Special Day per week, on a Saturday or Sunday — that
  day's lunch is a single Special-flagged dish and nothing else
- Hard pre-flight gate: generation is blocked entirely if the library
  has fewer than 1 Breakfast dish, fewer than 1 Main dish, or fewer
  than 1 Side-or-Soup dish, surfaced as a named blocking banner on the
  Dashboard
- Soft constraints (not enough flavor variety, not enough dishes to
  avoid a repeat within the current window, no Special dish available,
  no paired dish available for a Main) auto-relax with a specific,
  visible explanation of what was relaxed

### Manual Plan Editing

- Swap any dish in any slot for another dish of the same meal time
- Balance rules are checked but not enforced on edit — a violation
  shows a non-blocking warning and the edit still saves
- Regeneration always replaces the entire plan; there's no partial or
  per-day regeneration — manual edit is the only fine-grained
  mechanism

### Shopping List

- One deduplicated ingredient checklist per generated plan, aggregated
  from every dish in it
- Per-item checked state persists so progress isn't lost mid-shop

### Accounts

- Email/password authentication only
- Every dish, ingredient, plan, and shopping list is private to its
  owner

### Plan History

- Browse past plans, newest first, each retaining its own
  dishes/ingredients as they were at generation time

## Scope

### In Scope (v1)

- Everything listed under Features above
- Account settings: change name, change password, sign out

### Out of Scope (v1)

- Quantities or units on shopping list items (names only)
- Email verification
- Account deletion
- Partial or per-day regeneration
- A standalone "manage ingredients" screen (ingredients are managed
  inline, from the dish form, only)
- Sharing or collaborating on a dish library or plan between users
- Keeping more than one active plan at a time per user (only the
  current plan + history)
- Suggested or auto-generated dish pairings — a user always links
  dishes manually, one relationship at a time
- Pairing-aware behavior in manual plan editing (a swap stays scoped
  to same meal time only, regardless of pairing)
- Role-labeled lunch display (e.g. "Main"/"Side" tags on the day
  card) — pairing shapes generation only, not how a lunch is shown

## Success Criteria

1. A user with at least 1 Breakfast dish, 1 Main dish, and 1
   Side-or-Soup dish can generate a plan for any start date/duration
   and get a result with zero unexplained rule violations — every
   relaxation that occurs, including a forced or deliberate Main/Side
   flavor overlap, is named in a visible warning.
2. A generated plan's shopping list contains exactly the deduplicated
   ingredients used by its dishes, with no near-duplicate entries from
   naming variants.
3. A user below the minimum library size sees a specific, actionable
   message on the Dashboard (naming what's missing) instead of
   reaching a broken or empty Generate screen.
4. Editing a plan only ever offers same-meal-time replacement dishes,
   and a save succeeds even when it creates a rule violation, with the
   violation visibly flagged.
5. Archiving a dish never alters how that dish appears in plans
   generated before the archive happened.
6. A user who has paired their Main courses with complementary sides
   sees those specific combinations appear in generated plans, without
   any extra step beyond having set up the pairing.
7. Across a generated plan, the same dish never appears twice inside
   any single week, but reasonably can across different weeks.