# My Meal — Update: Dish Pairing & Plan Generation Rules

> **Relationship to other docs:** this follows `project-overview.md`'s exact
> section structure, scoped to just this update, so it can be reviewed on its
> own and then merged back into the main doc. It describes the product-level
> change only — *what* changes for users and *what rules* now govern
> generation. Implementation details (schema, algorithm pseudocode, warning
> codes, file-by-file work) live in `08-dish-pairing-and-plan-rules.md`; this
> doc is the source of truth for *intent*, that one is the source of truth for
> *how it's built*.
>
> **Supersedes**, in `project-overview.md`: the "Meal Plan Generation" bullet
> list under Features (Lunch composition and repeat rules specifically —
> Breakfast and Special Day bullets are unchanged). **Adds** a new Feature,
> "Dish Pairing," and a new Core User Flow.

## Overview

Dishes in a library don't just belong to a category and a flavor — some of
them belong *together*. This update lets a user record which dishes they
consider a natural combination (a curry with its usual side, a soup with its
usual accompaniment), and teaches the generator to build lunches around those
combinations instead of assembling categories at random. It also tightens
what a "valid lunch" means — a defined main course and a defined side, not
just an undifferentiated pile of two or three dishes — and loosens how
repeats are judged, so a smaller library doesn't get punished for reusing a
dish after a reasonable gap.

## Goals

1. Make generated lunches feel like intentional combinations a person would
   actually plan, not a category-shaped random draw — by letting the user
   teach the app which dishes belong together, once, in the library.
2. Preserve automatic flavor balance as the default, while acknowledging that
   real complementary dishes often do share a dominant flavor — so that
   overlap is treated as a normal, occasional outcome rather than something
   the generator fights to avoid at all costs.
3. Judge "no repeats" at a more forgiving, weekly grain instead of across the
   whole plan, so a two- or three-week plan doesn't force stale variety out of
   a modest-sized library.
4. Do all of this without changing what a user can rely on: a library that
   hasn't been paired yet still generates a complete, valid plan today.

## Core User Flows

Adds one new loop to the four in `project-overview.md`:

1. **Library loop** — add, edit, or archive dishes as the user's regular
   recipes change. *(Now also includes: link a dish to the other dishes it's
   usually served with.)*
2. **Pairing loop** *(new)* — from any Lunch dish's entry in the library,
   pick the other Lunch dishes it naturally goes with. The relationship is
   mutual: pairing "Chicken Potato Curry" with "Stir Fried Roselle Leaves"
   means both dishes now show the other as a pairing, without a second edit.
3. **Planning loop** (unchanged) — set a start date and duration → generate a
   plan → view it → use the generated shopping list while shopping → check
   items off. *(Generation itself now draws on the user's pairings — see
   Features below.)*
4. **Editing loop** (unchanged) — open an existing plan and swap an
   individual dish in a specific slot. Pairing has no effect here; a swap
   still offers every dish of the same meal time, exactly as before.
5. **Review loop** (unchanged) — browse past plans and their shopping lists.

## Features

### Dish Pairing *(new)*

- From a Lunch dish's form, a user can select any number of other Lunch
  dishes as "paired" with it — any category can pair with any other (a Main
  with a Side, a Main with a Soup, a Side with an Accompaniment, and so on).
- Pairing is always mutual: pairing Dish A to Dish B also pairs Dish B to
  Dish A, with no separate step required on B's side.
- Breakfast dishes can't be paired — breakfast is always a single dish, so a
  pairing on one would never be used.
- Pairing is optional. A dish with no pairings behaves exactly as it did
  before this update.

### Meal Plan Generation *(revised)*

- Each Lunch now has defined roles, not just an undifferentiated dish count:
  - **Main course** — mandatory, one per lunch.
  - **Side dish or Soup** — mandatory, one per lunch.
  - **Snack, Accompaniment, or Other** — optional; at most one, since the
    total is still capped at 3 dishes.
- The Main course is chosen at random from the library. Its Side dish or Soup
  is chosen from among the dishes the user has paired to that Main, when any
  exist. If the chosen Main has no pairings yet, generation still produces a
  valid, flavor-balanced lunch using the prior logic — pairing makes a plan
  more intentional, it never blocks one.
- Flavors are still required to be distinct across a lunch's dishes, with one
  deliberate, occasional exception: a Main and its paired Side/Soup are
  allowed to share a flavor about 3 times in 10 — reflecting that real
  well-paired dishes often do. When that happens, an optional third dish, if
  one is added, must be flavor-distinct from both — and is chosen from dishes
  paired to *both* the Main and the Side/Soup when such a dish exists, so the
  whole lunch still reads as one coherent combination rather than three
  unrelated picks.
- No dish repeats within any 7-day span of the plan. A dish used on a Monday
  can't reappear before the following Monday, but *can* reappear the week
  after that — replacing the previous rule, which forbade any repeat across
  the entire plan regardless of length.
- **Unchanged:** Breakfast is always 1 dish/day with no repeats for the whole
  plan; Special Day still occurs once per 2-week cycle on a weekend, with a
  single Special-flagged dish and nothing else that day; the pre-flight
  minimum-library gate still blocks generation outright rather than
  producing a broken plan (its exact thresholds are revised — see the
  Scope note below — but its role, and the fact that it's the *only* hard
  block, is unchanged).

### Manual Plan Editing (unaffected)

- Swapping a dish in an existing plan still offers every other dish of the
  same meal time, regardless of pairing. Balance rules — including the new
  weekly-repeat rule — are still checked but not enforced on edit, exactly as
  today: a violation shows a non-blocking warning and the edit still saves.

## Scope

### In Scope (this update)

- Defining and editing pairings between Lunch dishes, from the dish form
- Pairing-aware selection of a Main course's Side dish or Soup during
  generation, with a graceful fallback when no pairing exists
- Pairing-aware selection of the optional third lunch dish
- Revised minimum-library check: generation requires at least one Main dish
  and at least one Side-or-Soup dish (in addition to the existing minimum of
  one Breakfast dish), replacing the old flat "at least 2 Lunch dishes" check
- Weekly (7-day) no-repeat window for Lunch dishes specifically

### Out of Scope (this update)

- Any pairing-aware behavior in manual plan editing (swap stays exactly as
  it is today)
- Any change to Breakfast's rules or repeat window
- Suggested or auto-generated pairings — a user always links dishes manually,
  one relationship at a time
- Visual redesign of how a lunch's dishes are displayed in the plan view
  (role labels like "Main"/"Side" on the day card are a possible future
  polish item, not part of this update)

## Success Criteria

1. A user who has paired their Main courses with complementary sides sees
   those specific combinations appear in generated plans, without any extra
   step beyond having set up the pairing.
2. A user who hasn't paired anything yet still generates a complete, valid
   plan — pairing is additive, never a new precondition for the planning
   loop to work.
3. A generated lunch's flavor collisions, when they happen, are the
   deliberate, occasional exception described above, and are always
   explained — never silent, never the old "ran out of options" relaxation
   happening unexplained.
4. Across a generated plan, the same dish never appears twice inside any
   single week, but reasonably can across different weeks — verifiable by
   inspecting any 7-day span of a plan.
5. Manual plan editing, the shopping list, and plan history all behave
   identically to before this update — none of them were touched by it.