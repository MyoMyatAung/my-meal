# UI Context

## Source of Truth

This project now has a real `app/globals.css`, generated from a
specific shadcn theme preset
(https://ui.shadcn.com/create?preset=b1t52Uvx2&pointer=true). That
file is canonical for every design token below — it supersedes the
static prototype's `styles.css` wherever the two disagree.

- **Design tokens (color, radius, font wiring):** owned by
  `globals.css`. Don't hand-edit values here without updating that
  file to match, and vice versa.
- **Components:** default shadcn/ui, installed via the CLI and used
  as shipped — no custom restyling pass, no prototype-to-shadcn
  mapping table. (An earlier draft of this doc had one; it's been
  removed per direction — the prototype isn't a visual target
  anymore.)
- **The static HTML prototype** (`ui-prototype-build-guide.md`,
  `styles.css`, the page HTML files) is now **reference only** — useful
  for screen content, copy, dummy data, and layout/flow intent (what's
  on the dashboard, what a day-card contains), not for pixel-matching
  colors, radius, or component anatomy.

## Theme

Light and dark via a `.dark` class on the root element
(`@custom-variant dark (&:is(.dark *));` in `globals.css` confirms
this), matching the prototype's toggle mechanism — that part carries
over even though the prototype's specific color/radius values don't.

## Colors

All values below are copied directly from `globals.css`. They're wired
into Tailwind via the `@theme inline` block (e.g. `--color-primary:
var(--primary)`), so reference them as `bg-primary`, `text-foreground`,
etc. — standard shadcn/ui convention.

| Role                   | CSS Variable                   | Light                       | Dark                          |
| ------------------------ | -------------------------------- | ----------------------------- | -------------------------------- |
| Page background          | `--background`                 | `oklch(1 0 0)`               | `oklch(0.148 0.004 228.8)`      |
| Page text                | `--foreground`                 | `oklch(0.148 0.004 228.8)`   | `oklch(0.987 0.002 197.1)`      |
| Card surface             | `--card`                        | `oklch(1 0 0)`               | `oklch(0.218 0.008 223.9)`      |
| Card text                | `--card-foreground`             | `oklch(0.148 0.004 228.8)`   | `oklch(0.987 0.002 197.1)`      |
| Popover surface          | `--popover`                     | `oklch(1 0 0)`               | `oklch(0.218 0.008 223.9)`      |
| Popover text             | `--popover-foreground`          | `oklch(0.148 0.004 228.8)`   | `oklch(0.987 0.002 197.1)`      |
| Primary accent           | `--primary`                     | `oklch(0.52 0.105 223.128)`  | `oklch(0.45 0.085 224.283)`     |
| Primary accent text      | `--primary-foreground`          | `oklch(0.984 0.019 200.873)` | `oklch(0.984 0.019 200.873)`    |
| Secondary surface        | `--secondary`                   | `oklch(0.967 0.001 286.375)` | `oklch(0.274 0.006 286.033)`    |
| Secondary text           | `--secondary-foreground`        | `oklch(0.21 0.006 285.885)`  | `oklch(0.985 0 0)`              |
| Muted surface            | `--muted`                       | `oklch(0.963 0.002 197.1)`   | `oklch(0.275 0.011 216.9)`      |
| Muted text               | `--muted-foreground`            | `oklch(0.56 0.021 213.5)`    | `oklch(0.723 0.014 214.4)`      |
| Accent surface           | `--accent`                      | `oklch(0.963 0.002 197.1)`   | `oklch(0.275 0.011 216.9)`      |
| Accent text              | `--accent-foreground`           | `oklch(0.218 0.008 223.9)`   | `oklch(0.987 0.002 197.1)`      |
| Destructive              | `--destructive`                | `oklch(0.577 0.245 27.325)`  | `oklch(0.704 0.191 22.216)`     |
| Destructive text         | `--destructive-foreground`     | `oklch(0.984 0.019 200.873)` | `oklch(0.148 0.004 228.8)`      |
| Border                   | `--border`                      | `oklch(0.925 0.005 214.3)`   | `oklch(1 0 0 / 10%)`            |
| Input border             | `--input`                       | `oklch(0.925 0.005 214.3)`   | `oklch(1 0 0 / 15%)`            |
| Focus ring               | `--ring`                        | `oklch(0.723 0.014 214.4)`   | `oklch(0.56 0.021 213.5)`       |
| Chart 1–5                | `--chart-1` … `--chart-5`       | present                      | present                         |
| Sidebar surface          | `--sidebar`                     | `oklch(0.987 0.002 197.1)`   | `oklch(0.218 0.008 223.9)`      |
| Sidebar text             | `--sidebar-foreground`          | `oklch(0.148 0.004 228.8)`   | `oklch(0.987 0.002 197.1)`      |
| Sidebar active accent    | `--sidebar-primary`             | `oklch(0.609 0.126 221.723)` | `oklch(0.715 0.143 215.221)`    |
| Sidebar active accent text | `--sidebar-primary-foreground` | `oklch(0.984 0.019 200.873)` | `oklch(0.302 0.056 229.695)`    |
| Sidebar hover surface    | `--sidebar-accent`              | `oklch(0.963 0.002 197.1)`   | `oklch(0.275 0.011 216.9)`      |
| Sidebar hover text       | `--sidebar-accent-foreground`   | `oklch(0.218 0.008 223.9)`   | `oklch(0.987 0.002 197.1)`      |
| Sidebar border           | `--sidebar-border`              | `oklch(0.925 0.005 214.3)`   | `oklch(1 0 0 / 10%)`            |
| Sidebar focus ring       | `--sidebar-ring`                | `oklch(0.723 0.014 214.4)`   | `oklch(0.56 0.021 213.5)`       |

Notes:

- **`--chart-1` through `--chart-5` exist but are currently unused** —
  nothing in v1 charts data. Harmless to leave; remove later if the
  theme ever gets trimmed.
- **`--destructive-foreground` now exists**, added specifically so the
  default shadcn `Button` destructive variant has defined, reliable
  text contrast in both themes — values aren't shared between light
  and dark because `--destructive` itself flips lightness between
  them (mid-dark in light mode, noticeably lighter in dark mode), the
  same asymmetry already present in this theme's `sidebar-primary` /
  `sidebar-primary-foreground` pair. Treat these as a reasonable
  starting point and give them a quick visual check once the `Button`
  component is actually rendered — exact contrast tuning is easier to
  judge on screen than from token values alone.
- The prototype's `--surface-input` / `--surface-hover` / `--ring-soft`
  helper tokens (`color-mix()`-derived) don't exist in this
  `globals.css` and don't need to be added — they were only needed to
  hand-style hover/focus states on custom CSS components. Default
  shadcn components manage their own hover/focus/disabled states
  internally.
- Phase 6 warning surfaces (Dashboard blocking banner, plan warning
  carousel cards, day-card warning indicators) use the existing
  `destructive` token family. There is no separate `warning` token in
  this project.

## Border Radius

`globals.css` now sets `--radius: 0`, which zeroes out
`--radius-sm/md/lg/xl/2xl/3xl/4xl` along with it (each is a `calc()`
derived from `--radius`). This matches the prototype's original rule
— **every corner sharp, no exceptions** — confirmed, no longer an
open question. If a default shadcn component ever renders with
visible rounding, it's getting that from somewhere other than these
tokens (an inline style or a hardcoded class) and should be treated
as a bug to fix, not a one-off override to accept.

For Phase 6's warning carousel, the generated shadcn `carousel` nav
buttons are expected to remain sharp-cornered under this global radius
rule. Do not add `rounded-full` or any other `rounded-*` utility class
to those controls.

## Typography

`globals.css` wires `--font-sans` (and `--font-heading`, aliased to
the same value) into Tailwind. The actual typeface is **Inter**, loaded
via `next/font/google` in `app/layout.tsx` and applied via the
`--font-sans` CSS variable. This matches the prototype.

Tailwind's preflight strips default heading/paragraph styling, and
shadcn doesn't reintroduce a type scale on its own — so raw text
elements (`h1`, `h2`, body copy) still need utility classes applied
per element, the prototype's scale just isn't binding anymore. Useful
as a hierarchy *reference*, not a locked spec:

| Role                 | Reference size / weight | Color                |
| ---------------------- | -------------------------- | ----------------------- |
| Page title (`h1`)      | 22px / 600                 | `foreground`           |
| Section heading (`h2`) | 14px / 500                 | `foreground`           |
| Body (base)            | 13px / 400                 | `foreground`           |
| Secondary / meta       | 12px / 400                 | `muted-foreground`     |
| Micro label             | 12px / 500                 | varies by context       |

## Component Library

Default **shadcn/ui**, installed via the CLI (`components/ui/`), used
as shipped. No restyling pass, no prototype-component mapping — the
prototype's hand-rolled classes (`.btn`, `.badge`, `.segmented`,
`.dish-pill`, etc.) are not being ported or matched.

One functional carry-over from the spec, independent of styling:
**the ingredient input still needs to be a combobox, not free text.**
`meal-planner-spec.md` §2.1 requires ingredients to come from a
per-user master list via inline search-or-create — the prototype's
plain text input + chip list was only ever a placeholder for that.
In default-shadcn terms, that's the `Command` + `Popover` combobox
pattern, not a styling choice.

## Layout Patterns

These are carried over from the prototype as a structural starting
point — sidebar/content split, mobile behavior — not as locked pixel
values, since the project is no longer pixel-matching the prototype's
CSS:

- Fixed left sidebar with nav, collapsing to a top bar + slide-in
  drawer below a mobile breakpoint (prototype used ~860px / 216px
  sidebar width as a reference point).
- Main content area centered with a max width, sidebar offset via
  margin.
- Mobile drawer: full-height overlay from the left with a dimmed
  backdrop, closes on backdrop click, link click, or Escape.

Adjust freely to whatever spacing/width default shadcn layout
primitives suggest — these are intent, not spec.

## Icons

**Lucide** via `lucide-react` — unaffected by the theme change, and
already the icon set shadcn's own ecosystem expects. Same icon names
already in use from the prototype apply: `layout-dashboard`,
`calendar-days`, `utensils`, `shopping-cart`, `history`, `settings`,
`sun`, `moon`, `menu`, `plus`, `x`, `star`, `refresh-cw`, `pencil`,
`trash-2`, `chevron-left`, `chevron-right`, `check`, `triangle-alert`,
`lock`, `mail`, `log-out`, `arrow-left`, `calendar`.

(`settings`, `log-out`, `arrow-left`, `calendar` added in Phase 7 for
the Settings nav entry/sign-out affordance and the History list/detail
pages — none in the prototype's original icon set.)

## Open UI States Not Yet Designed

- **Dashboard "not enough dishes" blocking banner** — the message
  shown when generation is blocked by the hard pre-flight gate (see
  `architecture.md` Invariant 6). Still unaffected by this change, no
  visual reference exists per `meal-planner-spec.md` §6.

Resolved in Phase 7:

- **Account settings page** (change name, change password, sign out) —
  built as two stacked `Card`s ("Profile", "Password") plus an outline
  "Sign out" button, single-column, same max-width container as every
  other dashboard page. See
  `.agents/context/features/07-history-account-settings-polish.md` for
  the layout decision and rationale.