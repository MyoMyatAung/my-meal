# Phase 7 — History + Account Settings + Polish

## Goal

Let a user browse every past plan (newest first, read-only, immune to
later dish archiving) and manage their account (change name, change
password, sign out) from a dedicated Settings screen. Close out the
two UI states `ui-context.md` had flagged as "not yet designed"
(Account settings page — the Dashboard blocking banner was already
resolved in Phase 5/6) and fix the leftover `/plan` placeholder text
("History coming soon") with a real link.

## Deliverable

`/history` — list of every plan that isn't the current one, newest
first, each showing its date range, day count, and ingredient count.
`/history/[planId]` — read-only day-card view of one past plan,
structurally identical to `/plan`'s view but with no Edit/Generate
affordances.
`/settings` — change display name (synced into the session without
requiring sign-out), change password (current-password verified),
sign out.

---

## Current State (confirmed by reading the code, not assumed)

- **Sidebar nav already links to `/history`** (`components/sidebar.tsx`)
  and the Dashboard already has a "History" quick-link card
  (`app/(dashboard)/page.tsx`) — neither route exists yet, both 404
  today.
- **The Dashboard blocking banner is already implemented and correctly
  styled** (`MIN_BREAKFAST_DISHES`/`MIN_LUNCH_DISHES` gate, destructive
  tokens) — `00-all-phases.md`'s Phase 7 description mentions it, but
  it's done; nothing to build here.
- **`components/plan-view.tsx`** has a dead placeholder line — `<p>`
  reading "History coming soon" — left over from a Phase 6 bug fix
  before `/history` existed. Replace with a real link.
- **No `/settings` route, no Settings nav item, no session-update
  wiring exist yet.** `app/layout.tsx` has no `<SessionProvider>`.
  `lib/auth.ts`'s `jwt` callback only ever sets `token.id` — it has no
  `trigger === "update"` branch, so there is currently no mechanism to
  push a changed name into the session without a full sign-out/sign-in.
- **"Current plan" has no DB flag.** `getCurrentPlan()` already defines
  it implicitly: `mealPlan.findFirst({ where: { userId }, orderBy: {
  createdAt: "desc" } })` — the single most-recently-created row.
  History must use the same definition of "current" so the two screens
  never disagree about which plan is "the" plan vs. "a past plan."

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| What counts as "history" | **Every `MealPlan` row for the user except the most-recently-created one** (same row `getCurrentPlan()` already treats as current). `getPlanHistory()` fetches all plans ordered `createdAt desc` and drops index 0. | `project-overview.md`'s Out of Scope list says "only the current plan + history" — implying exactly one current plan and everything else is history. No schema change needed; this is a query-level distinction, consistent with how `getCurrentPlan()` already picks "current" without a flag. |
| History list query shape | **New lightweight query, not reused entries-tree.** Select only `id, startDate, endDate, createdAt`, plus `_count.shoppingItems` for the ingredient count shown on each card. No entries/dishes fetched for the list. | Same precedent as Phase 6's `getCurrentShoppingList()` — a screen that only needs summary fields gets its own narrow query instead of overfetching the full plan graph. |
| Day count on the history card | **Computed from `startDate`/`endDate`, not a stored field**: `Math.round((end - start) / 86400000) + 1`. | No `durationDays` column exists on `MealPlan`; the date range already fully determines it, so storing a redundant derived value would risk drifting from the dates themselves. |
| Detail-page data + reuse | **New `getPlanById(planId)`, sharing its query shape with `getCurrentPlan()` via one private helper** (`findPlanWithWarnings`) instead of two near-duplicate Prisma queries. | Phase 6 already established that `getCurrentPlan()`'s entries/dishes include + `computeEntryWarnings` attachment is a single well-defined shape. Two call sites (current-plan lookup, by-id lookup) now exist, which is exactly the "at least two concrete cases" bar `code-standards.md` sets before extracting a shared helper. |
| Detail-page component | **Server Component page, no client wrapper.** Unlike `/plan` (needs the Generate-form toggle) and `/plan/edit` (needs Select/toast interactivity), the history detail view has nothing interactive of its own — it directly renders `<DayCard>` (already `"use client"` in its own file) and `<PlanWarningsCarousel>` (already `"use client"`) from a plain `async function Page`. | Matches `code-standards.md`: "Add `use client` only when browser interactivity requires it." Nothing on this page does. |
| Ownership + not-found handling | **`getPlanById` scopes to `{ id: planId, userId }`; if `null`, the page redirects to `/history`** — no distinct "not found" page. | Matches the existing pattern in `app/(dashboard)/plan/edit/page.tsx` (`if (!plan) redirect("/plan")`). A `planId` that's missing, malformed, or belongs to another user is indistinguishable from the user's own perspective — a bare redirect avoids leaking which case it was. |
| Warnings on the historical view | **Show them, read-only** (same `buildWarningCards` + `PlanWarningsCarousel` already used by `/plan`), since `computeEntryWarnings` is a pure function of that plan's own frozen entries and never changes after the fact for a past plan. No edit affordance, so nothing can act on them — informational only. | Reuses existing, already-tested code (`lib/planner/edit-warnings.ts`, `lib/utils/warning-cards.ts`) with zero new logic. Omitting warnings entirely would make history strictly less informative than `/plan` for no reason. |
| Archived dishes in history | **No special handling needed** — already guaranteed by `architecture.md` Invariant 2 (an archived dish's existing plan reference must keep resolving/rendering). History just renders whatever `getPlanById` returns, same as `/plan` does today. | Nothing new to build; confirming this holds is part of the verification checklist below, not new code. |
| Empty history state | **"No past plans yet" message + link to `/plan`,** shown when a user has generated 0 or exactly 1 plan (i.e. `getPlanHistory()` returns `[]`). | Mirrors the existing empty-state pattern in `/shopping-list` (Phase 6). |
| **Account Settings layout** | **Two stacked `Card`s on one `/settings` page — "Profile" (name field + Save) and "Password" (current/new/confirm + Save) — plus a `Button variant="outline"` "Sign out" below both**, all in a single-column max-width container (same as every other dashboard page). | `ui-context.md` explicitly flagged this page as having no visual reference. `project-overview.md` scopes exactly these three actions ("change name, change password, sign out") with nothing else — a flat two-card layout is the simplest structure that satisfies the scope without inventing tabs, a wizard, or extra sections (no account deletion, no email change — both explicitly out of scope). |
| **Sign out button on `/settings`, in addition to the sidebar's** | **Duplicate the affordance** — both call the same `signOut({ callbackUrl: "/sign-in" })`. | `project-overview.md` lists "sign out" as one of the three named Account Settings actions, so the settings page should be a complete, self-contained account-management screen even though the sidebar already exposes the same action globally. Zero new logic — same call, second location. |
| **Session staleness after a name change** | **Fix it properly, not with a caveat.** Add `<SessionProvider>` to the root layout, extend `lib/auth.ts`'s `jwt` callback with a `trigger === "update"` branch that copies `session.name` into `token.name`, and have the Profile form call `next-auth/react`'s `useSession().update({ name })` right after a successful `updateNameAction`, then `router.refresh()` so the Sidebar (which reads `getServerSession()` server-side in `app/(dashboard)/layout.tsx`) re-renders with the new name in the same tick — no sign-out/sign-in required. | Without this, `token.name` is baked into the JWT only at sign-in time (NextAuth v4's default `jwt` callback pre-fills `token` from the `user` object once, on first sign-in, and this project's custom `jwt` callback never revisits it) — a user could change their name here and still see the old one in the Sidebar/greeting until their session expires. This is Auth.js's documented, standard mechanism for exactly this case (`session.update()` + `trigger: "update"` in `jwt`), not a bespoke workaround — confirmed by reading `next-auth`'s own `core/types.d.ts` (`trigger?: "signIn" | "signUp" | "update"`) and `react/index.d.ts` (`update: UpdateSession` on the `useSession()` return value). Adding `SessionProvider` has no effect on any existing code — nothing currently calls `useSession()`, and `signOut()` (already used in the Sidebar) doesn't require the provider to function. |
| Password change validation | **Reuse the exact password-complexity rule already in `SignUpSchema`** (`lib/zod/auth.ts`) by extracting it into a shared `PasswordSchema` and having both `SignUpSchema.password` and the new `UpdatePasswordSchema.newPassword` reference it. | Avoids two regexes that could silently drift apart (e.g. sign-up requires 8+ chars/letter/number but a password change accepts something weaker). This is a pure refactor of an existing file — `SignUpSchema`'s external shape (its own `.password` field) is unchanged, so no other caller is affected. |
| Current-password verification | **Server-side only** — `updatePasswordAction` loads the user's stored hash and `bcrypt.compare`s the submitted `currentPassword` before accepting `newPassword`. Wrong current password → `{ success: false, error: "Current password is incorrect" }`, no partial update. | Standard "confirm you are who you say you are" gate before a credential change; mirrors the same bcrypt-compare-then-branch shape already used in `lib/auth.ts`'s `authorize()`. |
| New Settings nav entry | **Add `{ label: "Settings", href: "/settings", icon: Settings }` to `navItems`** in `components/sidebar.tsx`, placed after "History" (last item, above the theme/sign-out footer — it's account-level, not a content section like the other four). | The prototype's sidebar has no Settings link (`ui-context.md` already notes the page had no visual reference at all), so placement is a new, flagged decision rather than a port from anything. Lucide's `Settings` icon is a new addition to the icon list in `ui-context.md` — record it there. |

---

## Sub-phase Split

Per `ai-workflow-rules.md`: Server Actions verified before the UI that
calls them; `/history` and `/settings` are separate system boundaries
from each other and from everything built in Phases 1–6.

- **7A — History data layer**: `getPlanHistory()`, `getPlanById()`
  (+ the shared `findPlanWithWarnings` refactor of `getCurrentPlan()`).
  No UI.
- **7B — History UI**: `/history` list page, `/history/[planId]`
  detail page, sidebar/dashboard links already point here — just wire
  the routes; fix the `plan-view.tsx` placeholder text. Depends on 7A.
- **7C — Account settings data layer**: `lib/zod/settings.ts`
  (`UpdateNameSchema`, `UpdatePasswordSchema`, shared `PasswordSchema`
  extracted from `lib/zod/auth.ts`), `app/actions/settings.ts`
  (`updateNameAction`, `updatePasswordAction`). No UI.
- **7D — Account settings UI + session sync**: `<SessionProvider>` in
  `app/layout.tsx`, `jwt` callback `trigger: "update"` branch, `/settings`
  page, `UpdateNameForm`, `UpdatePasswordForm`, `SignOutButton`, new
  sidebar nav entry. Depends on 7C.

7A/7B and 7C/7D are independent of each other and can be built in
either order.

---

## Phase 7A — History Data Layer

### Step 1: Extract `findPlanWithWarnings` and add `getPlanHistory` / `getPlanById`

**File:** `app/actions/plan.ts` (modify)

Refactor the query + `entryWarnings`-attachment logic currently inline
in `getCurrentPlan()` into a private helper parameterized by `where`
and an optional `orderBy`, then add two new exported functions on top
of it:

```typescript
import { Prisma } from "@prisma/client"

async function findPlanWithWarnings(
  where: Prisma.MealPlanWhereInput,
  orderBy?: Prisma.MealPlanOrderByWithRelationInput,
) {
  const plan = await prisma.mealPlan.findFirst({
    where,
    orderBy,
    include: {
      entries: {
        include: {
          dishes: {
            include: {
              dish: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  isSpecial: true,
                  flavors: { select: { flavor: { select: { name: true } } } },
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: [{ date: "asc" }, { mealTime: "asc" }],
      },
      shoppingItems: {
        include: { ingredient: { select: { id: true, name: true } } },
      },
    },
  })

  if (!plan) return null

  const warningInput: WarningEntry[] = plan.entries.map((entry) => ({
    entryId: entry.id,
    mealTime: entry.mealTime,
    dishes: entry.dishes.map((entryDish) => ({
      dishId: entryDish.dish.id,
      dishName: entryDish.dish.name,
      flavors: entryDish.dish.flavors.map((f) => f.flavor.name),
    })),
  }))
  const warningsByEntry = computeEntryWarnings(warningInput)

  return {
    ...plan,
    entries: plan.entries.map((entry) => ({
      ...entry,
      entryWarnings: warningsByEntry.get(entry.id) ?? [],
    })),
  }
}

export async function getCurrentPlan() {
  const userId = await getUserId()
  return findPlanWithWarnings({ userId }, { createdAt: "desc" })
}

export async function getPlanById(planId: string) {
  const userId = await getUserId()
  return findPlanWithWarnings({ id: planId, userId })
}

export async function getPlanHistory() {
  const userId = await getUserId()

  const plans = await prisma.mealPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      _count: { select: { shoppingItems: true } },
    },
  })

  // Index 0 is "the current plan" — same definition getCurrentPlan() uses.
  // Everything after it is history.
  return plans.slice(1).map((plan) => ({
    id: plan.id,
    startDate: plan.startDate,
    endDate: plan.endDate,
    dayCount:
      Math.round(
        (plan.endDate.getTime() - plan.startDate.getTime()) / 86_400_000,
      ) + 1,
    ingredientCount: plan._count.shoppingItems,
  }))
}
```

`getCurrentPlan()`'s external return shape and every existing caller
(`app/(dashboard)/page.tsx`, `app/(dashboard)/plan/page.tsx`,
`app/(dashboard)/plan/edit/page.tsx`) are unaffected — this is a
pure internal refactor.

### ✅ Verify 7A

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` / `pnpm run build` | Pass |
| 2 | `npx vitest run` | Unaffected — no `lib/planner/*` file touched |
| 3 | `getCurrentPlan()` unchanged behavior | Generate a plan, load `/` and `/plan` — identical to pre-refactor output |
| 4 | `getPlanHistory()` excludes current | With 2+ plans generated, confirm the array returned never includes the most-recently-created plan's `id` |
| 5 | `getPlanHistory()` empty with ≤ 1 plan | With exactly one plan ever generated, `getPlanHistory()` returns `[]` |
| 6 | `getPlanHistory()` scopes to owner | Another user's plans never appear |
| 7 | `getPlanById()` scopes to owner | Call with another user's `planId` → `null` |
| 8 | `getPlanById()` returns full entries | Matches the shape `getCurrentPlan()` returns, including `entryWarnings` |
| 9 | `dayCount` matches generation input | A 14-day plan reports `dayCount: 14` |

---

## Phase 7B — History UI

### Step 2: Fix the `/plan` placeholder

**File:** `components/plan-view.tsx` (modify)

Replace:

```tsx
<p className="mb-4 text-sm text-muted-foreground">
  History coming soon
</p>
```

with:

```tsx
<Link
  href="/history"
  className="mb-4 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
>
  View past plans →
</Link>
```

(`Link` from `next/link` — already imported in this file for "Edit plan".)

### Step 3: History list page

**File:** `app/(dashboard)/history/page.tsx` (create)

Server Component.

```tsx
import Link from "next/link"
import { Calendar, ChevronRight } from "lucide-react"
import { getPlanHistory } from "@/app/actions/plan"
import { Card, CardContent } from "@/components/ui/card"
import { formatCalendarDate, parseCalendarDate } from "@/lib/utils/date"

export default async function HistoryPage() {
  const plans = await getPlanHistory()

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Past plans</h1>

      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No past plans yet —{" "}
          <Link href="/plan" className="underline underline-offset-4">
            generate a plan
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const start = parseCalendarDate(plan.startDate.toISOString().slice(0, 10))
            const end = parseCalendarDate(plan.endDate.toISOString().slice(0, 10))
            return (
              <Link key={plan.id} href={`/history/${plan.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="size-5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">
                          {formatCalendarDate(start, { month: "short", day: "numeric" })}
                          {" – "}
                          {formatCalendarDate(end, { month: "short", day: "numeric" })}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {plan.dayCount} days · {plan.ingredientCount} ingredients
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

### Step 4: History detail page

**File:** `app/(dashboard)/history/[planId]/page.tsx` (create)

Server Component. `params` is a Promise (Next.js 15+ convention,
confirmed against `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`
per `AGENTS.md`'s framework-doc-first rule) — must `await` it.

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getPlanById } from "@/app/actions/plan"
import { DayCard } from "@/components/day-card"
import { PlanWarningsCarousel } from "@/components/plan-warnings-carousel"
import { buildWarningCards } from "@/lib/utils/warning-cards"
import { buildEntriesByDate, buildWeeksFromDateKeys } from "@/lib/utils/plan-grouping"
import { formatCalendarDate, parseCalendarDate } from "@/lib/utils/date"

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  const plan = await getPlanById(planId)

  if (!plan) redirect("/history")

  const startDate = parseCalendarDate(plan.startDate.toISOString().slice(0, 10))
  const endDate = parseCalendarDate(plan.endDate.toISOString().slice(0, 10))
  const dateRange = `${formatCalendarDate(startDate, { month: "short", day: "numeric" })} – ${formatCalendarDate(endDate, { month: "short", day: "numeric" })}`

  const entriesByDate = buildEntriesByDate(
    plan.entries.map((e) => ({ ...e, date: e.date.toISOString() })),
  )
  const weeks = buildWeeksFromDateKeys(Array.from(entriesByDate.keys()))

  const planWarningMessages = (plan.warnings as string[]) ?? []
  const warningCards = buildWarningCards(
    planWarningMessages,
    plan.entries.map((entry) => ({
      date: entry.date.toISOString().slice(0, 10),
      entryWarnings: entry.entryWarnings,
    })),
  )

  return (
    <div>
      <Link
        href="/history"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Past plans
      </Link>

      <h1 className="mb-6 text-lg font-semibold">{dateRange}</h1>

      <PlanWarningsCarousel warnings={warningCards} />

      {weeks.map((week) => (
        <div key={week.label} className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            ── {week.label} ──
          </h2>
          <div className="space-y-3">
            {week.dates.map((dateKey) => {
              const day = entriesByDate.get(dateKey)!
              return (
                <DayCard
                  key={dateKey}
                  date={parseCalendarDate(dateKey)}
                  breakfast={day.breakfast}
                  lunch={day.lunch}
                  isSpecialDay={day.isSpecialDay}
                  warnings={day.warnings}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
```

No `editable`/`swappableDishes` props passed to `<DayCard>` — defaults
to read-only, which is exactly what a past plan should be.

### ✅ Verify 7B

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` / `pnpm run build` | Pass |
| 2 | `/plan` link works | "View past plans →" navigates to `/history` |
| 3 | Sidebar + Dashboard links work | Both already point at `/history` — confirm no more 404 |
| 4 | List renders newest first | Generate 3 plans; history shows the older 2, most recent history entry first |
| 5 | Empty state | A fresh user (or one with exactly 1 plan) sees "No past plans yet" |
| 6 | Detail page renders | Click a history card → correct date range, correct day cards, correct dishes |
| 7 | Detail page is read-only | No Edit/Generate button anywhere on `/history/[planId]` |
| 8 | Unknown/foreign `planId` redirects | Visiting `/history/does-not-exist` (or another user's real plan id) redirects to `/history`, no error page |
| 9 | Archived dish still renders in history | Archive a dish present in a past plan — its name still shows correctly on that plan's detail page |
| 10 | Warnings display, no edit affordance | A past plan with a flavor-collision or repeat warning shows the carousel; day cards show only the border/icon indicator, same as `/plan` |
| 11 | Mobile responsive | Sidebar collapses, list and detail cards stack |

---

## Phase 7C — Account Settings Data Layer

### Step 5: Extract shared `PasswordSchema`, add settings schemas

**File:** `lib/zod/auth.ts` (modify — additive, no external shape change)

```typescript
export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number")

export const SignUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Please enter a valid email"),
  password: PasswordSchema,
})
```

(`SignInSchema` untouched — sign-in only checks presence, not
complexity, since that's validating an *existing* password.)

**File:** `lib/zod/settings.ts` (create)

```typescript
import { z } from "zod"
import { PasswordSchema } from "@/lib/zod/auth"

export const UpdateNameSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
})

export const UpdatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: PasswordSchema,
})
```

### Step 6: Settings Server Actions

**File:** `app/actions/settings.ts` (create)

```typescript
"use server"

import bcrypt from "bcryptjs"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { UpdateNameSchema, UpdatePasswordSchema } from "@/lib/zod/settings"

async function getUserId() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

export async function updateNameAction(input: { name: string }) {
  try {
    const userId = await getUserId()

    const parsed = UpdateNameSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false as const, error: "Invalid name" }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { name: parsed.data.name },
    })

    return { success: true as const, data: { name: parsed.data.name } }
  } catch {
    return { success: false as const, error: "Failed to update name" }
  }
}

export async function updatePasswordAction(input: {
  currentPassword: string
  newPassword: string
}) {
  try {
    const userId = await getUserId()

    const parsed = UpdatePasswordSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false as const, error: "Invalid password" }
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.password) {
      return { success: false as const, error: "Account not found" }
    }

    const isValid = await bcrypt.compare(parsed.data.currentPassword, user.password)
    if (!isValid) {
      return { success: false as const, error: "Current password is incorrect" }
    }

    const hashed = await bcrypt.hash(parsed.data.newPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    })

    return { success: true as const }
  } catch {
    return { success: false as const, error: "Failed to update password" }
  }
}
```

### ✅ Verify 7C

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` / `pnpm run build` | Pass |
| 2 | `npx vitest run` | Unaffected |
| 3 | `updateNameAction` rejects short name | `{ name: "A" }` → `success: false` |
| 4 | `updateNameAction` persists | Call with a valid name, `prisma.user.findUnique` confirms the DB row changed |
| 5 | `updatePasswordAction` rejects wrong current password | Wrong `currentPassword` → `"Current password is incorrect"`, password unchanged |
| 6 | `updatePasswordAction` rejects weak new password | `newPassword: "short"` → `success: false`, nothing hashed/stored |
| 7 | `updatePasswordAction` persists + old password stops working | After a successful change, signing in with the old password fails and the new one succeeds |
| 8 | Both actions scope to the session user | Cannot be called without a session (throws, caught, returns `success: false` via the outer try/catch) |

---

## Phase 7D — Account Settings UI + Session Sync

### Step 7: Mount `SessionProvider`

**File:** `app/layout.tsx` (modify)

```tsx
import { SessionProvider } from "next-auth/react"

// inside <body>, wrapping everything already there:
<SessionProvider>
  <ThemeProvider>
    {children}
    <Toaster />
  </ThemeProvider>
</SessionProvider>
```

No `session` prop passed in — the client fetches it itself on mount.
This has no effect on any existing code path: nothing currently calls
`useSession()`, and `signOut()` (already used in `components/sidebar.tsx`)
doesn't require the provider.

### Step 8: `jwt` callback — handle session updates

**File:** `lib/auth.ts` (modify)

```typescript
callbacks: {
  async jwt({ token, user, trigger, session }) {
    if (user) token.id = user.id
    if (trigger === "update" && session?.name) {
      token.name = session.name
    }
    return token
  },
  async session({ session, token }) {
    session.user.id = token.id
    return session
  },
},
```

### Step 9: Settings page

**File:** `app/(dashboard)/settings/page.tsx` (create)

Server Component — passes the current name down so the Profile form
has a real default value on first paint (no flash of empty input).

```tsx
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { UpdateNameForm } from "@/components/update-name-form"
import { UpdatePasswordForm } from "@/components/update-password-form"
import { SignOutButton } from "@/components/sign-out-button"
import { Card, CardContent } from "@/components/ui/card"

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Account settings</h1>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Profile</h2>
            <UpdateNameForm currentName={session?.user?.name ?? ""} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Password</h2>
            <UpdatePasswordForm />
          </CardContent>
        </Card>

        <SignOutButton />
      </div>
    </div>
  )
}
```

### Step 10: Profile (name) form — with session sync

**File:** `components/update-name-form.tsx` (create, `"use client"`)

Follows the same manual-`useState` + inline-error convention already
established by `SignUpForm` (`app/(auth)/sign-up/sign-up-form.tsx`) —
no new form library.

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateNameAction } from "@/app/actions/settings"

export function UpdateNameForm({ currentName }: { currentName: string }) {
  const router = useRouter()
  const { update } = useSession()
  const [name, setName] = useState(currentName)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)

    const result = await updateNameAction({ name })
    setPending(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    await update({ name: result.data.name })
    router.refresh()
    toast.success("Name updated")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Name</span>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save name"}
      </Button>
    </form>
  )
}
```

`router.refresh()` re-runs `app/(dashboard)/layout.tsx` server-side,
which re-reads `getServerSession()` — now decoding the JWT cookie
`update()` just rewrote — so the Sidebar's displayed name updates in
the same interaction, no sign-out required.

### Step 11: Password form

**File:** `components/update-password-form.tsx` (create, `"use client"`)

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updatePasswordAction } from "@/app/actions/settings"

export function UpdatePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match")
      return
    }

    setPending(true)
    const result = await updatePasswordAction({ currentPassword, newPassword })
    setPending(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    toast.success("Password updated")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Current password</span>
        <Input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">New password</span>
        <Input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Confirm new password</span>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </label>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  )
}
```

"New passwords don't match" is checked client-side only (nothing to
persist if they disagree) — `updatePasswordAction` never receives
`confirmPassword`, it's not part of `UpdatePasswordSchema`.

### Step 12: Sign-out button

**File:** `components/sign-out-button.tsx` (create, `"use client"`)

```tsx
"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      onClick={() => signOut({ callbackUrl: "/sign-in" })}
      className="w-fit"
    >
      <LogOut className="size-4" /> Sign out
    </Button>
  )
}
```

### Step 13: Sidebar nav entry

**File:** `components/sidebar.tsx` (modify)

```typescript
import { Settings } from "lucide-react"

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Plan", href: "/plan", icon: CalendarDays },
  { label: "Dishes", href: "/dishes", icon: Utensils },
  { label: "Shopping list", href: "/shopping-list", icon: ShoppingCart },
  { label: "History", href: "/history", icon: History },
  { label: "Settings", href: "/settings", icon: Settings },
]
```

### ✅ Verify 7D

| # | Check | How |
|---|---|---|
| 1 | `pnpm run typecheck` / `pnpm run build` | Pass |
| 2 | Settings nav entry works | Click "Settings" in the sidebar → lands on `/settings` |
| 3 | Name field pre-fills | Current name shows in the Profile input on load |
| 4 | Name change persists | Change name, refresh page (hard reload) — new name still there |
| 5 | Name change syncs without sign-out | After saving a new name, the Sidebar's displayed name (bottom-left) updates immediately, no sign-out/sign-in | 
| 6 | Name validation | Submitting a 1-character name shows a toast error, nothing saved |
| 7 | Password happy path | Correct current password + valid new password → success toast, fields clear |
| 8 | Wrong current password | Shows "Current password is incorrect" toast, nothing changes |
| 9 | Weak new password | Rejected client's `updatePasswordAction` call, error toast shown |
| 10 | Mismatched confirm field | Client-side toast "New passwords don't match", no server call made (verify via network tab or a temporary log) |
| 11 | New password actually works | Sign out, sign back in with the new password — succeeds; old password now fails |
| 12 | Sign out from Settings | Clicking "Sign out" on `/settings` ends the session and redirects to `/sign-in`, same as the Sidebar's button |
| 13 | SessionProvider doesn't break anything else | Full click-through of `/`, `/plan`, `/dishes`, `/shopping-list`, `/history` — no new console errors, no layout shift |
| 14 | Mobile responsive | Sidebar collapses, Settings cards stack, forms remain usable |

---

## Files Summary

| File | Action | Sub-phase | Description |
|---|---|---|---|
| `app/actions/plan.ts` | Modify | 7A | Extract `findPlanWithWarnings`; add `getPlanById`, `getPlanHistory` |
| `components/plan-view.tsx` | Modify | 7B | Replace "History coming soon" with a real `/history` link |
| `app/(dashboard)/history/page.tsx` | Create | 7B | History list — cards, newest first, empty state |
| `app/(dashboard)/history/[planId]/page.tsx` | Create | 7B | Read-only detail view for one past plan |
| `lib/zod/auth.ts` | Modify | 7C | Extract `PasswordSchema`, reused by `SignUpSchema` |
| `lib/zod/settings.ts` | Create | 7C | `UpdateNameSchema`, `UpdatePasswordSchema` |
| `app/actions/settings.ts` | Create | 7C | `updateNameAction`, `updatePasswordAction` |
| `app/layout.tsx` | Modify | 7D | Mount `<SessionProvider>` |
| `lib/auth.ts` | Modify | 7D | `jwt` callback: handle `trigger === "update"` |
| `app/(dashboard)/settings/page.tsx` | Create | 7D | Settings page — Profile card, Password card, Sign out |
| `components/update-name-form.tsx` | Create | 7D | Name form; calls `useSession().update()` + `router.refresh()` |
| `components/update-password-form.tsx` | Create | 7D | Password form; client-side confirm-match check |
| `components/sign-out-button.tsx` | Create | 7D | Settings-page sign-out, same call as the Sidebar's |
| `components/sidebar.tsx` | Modify | 7D | Add "Settings" nav item |
| `.agents/context/ui-context.md` | Update | — | Resolve the Account Settings open UI state; add `Settings` to the icon list |
| `.agents/context/features/07-history-acction-settings-polish.md` | Update | — | This plan document |
| `.agents/context/progress-tracker.md` | Update | — | Mark Phase 7 complete |

---

## Key Constraints

- No schema change — "current plan" stays a query-time distinction
  (`orderBy: createdAt desc`, take the first), never a stored flag.
  `getPlanHistory()` must always agree with `getCurrentPlan()` about
  which single plan is "current."
- `getPlanById`/`getPlanHistory` scope to `session.user.id`, same as
  every other Server Action in the project (`architecture.md`, Auth
  and Access Model).
- The history detail page is fully read-only — no Edit, no Regenerate,
  no swap affordance anywhere. Only `/plan` and `/plan/edit` can change
  the current plan's dishes.
- Archived dishes must keep resolving/rendering in history, same
  invariant already relied on by `/plan` and `/plan/edit`
  (`architecture.md` Invariant 2) — nothing new to implement, just
  confirm it holds.
- Session-name sync is the officially documented Auth.js v4 mechanism
  (`session.update()` client-side + `trigger === "update"` in the
  `jwt` callback) — not a bespoke refresh workaround.
- Password changes always re-verify the current password server-side
  before accepting a new one; the complexity rule for new passwords is
  shared with sign-up via one `PasswordSchema`, never duplicated.
- No `rounded-*` Tailwind classes; no hardcoded hex colors; destructive-styled
  toasts/errors follow the same `sonner` pattern already established in
  Phase 6.

---

## Overall Verification Checklist

1. `pnpm run typecheck` — zero errors
2. `pnpm run build` — passes
3. `npx vitest run` — all existing tests still pass (nothing in this
   phase touches `lib/planner/*`)
4. `/history` lists every plan except the current one, newest first,
   with correct day/ingredient counts, and an empty state when there
   are none
5. `/history/[planId]` renders a past plan read-only, including its
   warnings, with an archived dish (if any) still resolving correctly
6. An unknown or foreign `planId` redirects to `/history` instead of
   erroring
7. `/plan`'s "View past plans" link actually navigates to `/history`
8. `/settings` lets a user change their name (with the Sidebar
   reflecting the change immediately, no sign-out required), change
   their password (old password stops working, new one works,
   current-password re-verification enforced), and sign out
9. Sidebar has a working "Settings" nav entry
10. Mobile responsive across all new screens
11. `progress-tracker.md` and `ui-context.md` updated to reflect
    Phase 7's completed scope and resolved open UI state
