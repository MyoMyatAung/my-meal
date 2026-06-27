# My Meal

## Overview

My Meal is a multi-user web app for weekly meal planning and shopping.
Each user maintains a private library of dishes (recipes) tagged with
category, flavor, meal time, and ingredients. From that library, the
app randomly generates a meal plan for a user-chosen date range —
enforcing flavor balance per lunch, no dish repeats within the period,
and a once-per-two-weeks "Special Day" — then aggregates every
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
   regular recipes change.
2. **Planning loop** (the primary loop) — set a start date and
   duration → generate a plan → view it → use the generated shopping
   list while shopping → check items off.
3. **Editing loop** — open an existing plan and swap an individual
   dish in a specific slot, without regenerating the whole period.
4. **Review loop** — browse past plans and their shopping lists.

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

### Meal Plan Generation

- User sets start date and duration (default 14 days; any number of
  days/weeks)
- Breakfast: 1 dish/day, no flavor rule, no repeats within the period
- Lunch: 2–3 dishes/day, all flavors distinct within that lunch, no
  repeats within the period
- Exactly one Special Day per 2-week cycle, on a Saturday or Sunday —
  that day's lunch is a single Special-flagged dish and nothing else
- Hard pre-flight gate: generation is blocked entirely if the library
  has fewer than 1 Breakfast dish or 2 Lunch dishes, surfaced as a
  named blocking banner on the Dashboard
- Soft constraints (not enough flavor variety, not enough dishes to
  avoid a repeat, no Special dish available) auto-relax with a
  specific, visible explanation of what was relaxed

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

## Success Criteria

1. A user with at least 1 Breakfast dish and 2 Lunch dishes can
   generate a plan for any start date/duration and get a result with
   zero unexplained rule violations — every relaxation that occurs is
   named in a visible warning.
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