# Phase 2 — Auth + Layout Shell

## Goal

Set up Auth.js with the Credentials provider, build sign-in/sign-up pages, and
create the app layout shell with sidebar navigation. Deliverable: working auth
flow (sign up, sign in, sign out) with a basic app shell.

> **Revision note:** this replaces the earlier draft of this plan, which was
> written against `next-auth` v5 (Auth.js) syntax — `const { handlers, signIn,
> signOut, auth } = NextAuth({...})`. That API doesn't exist in v4, and v5 is
> still beta-only on npm. Per explicit decision, this project uses **v4
> stable** instead. v4 has no unified `auth()`/server-callable `signIn()` —
> see Design Decisions below for what that changes structurally, not just
> cosmetically.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth library | `next-auth` v4 (the `latest` dist-tag, currently 4.24.x) | Explicit requirement: no beta/pre-release deps. v5 ("Auth.js") is still beta-tagged on npm. |
| Database adapter | **None** — no `@next-auth/prisma-adapter` | That package's last release is ~3 years old; its compatibility with the Prisma 7 client already adopted in Phase 1 is unverified. It's also functionally unnecessary: Credentials auth never calls adapter `createUser`/`linkAccount` — `authorize()` and the signup Server Action do their own Prisma calls directly. JWT sessions need no adapter. |
| `Account` / `Session` tables | Stay in the schema, simply unused | Already migrated in Phase 1; touching `prisma/schema.prisma` now would mean an unnecessary migration on a protected file. Leaving them costs nothing and leaves room for OAuth providers later. |
| Session strategy | JWT | Required for the Credentials provider regardless of version. |
| Server-side session reads | `getServerSession(authOptions)` from `next-auth/next` | v4's equivalent of v5's `auth()` — called explicitly wherever a Server Component or Server Action needs the session. |
| Route protection | `proxy.ts` + `getToken()` from `next-auth/jwt` | v4 has no `auth()` wrapper for proxy/middleware. `getToken()` decodes the JWT cookie directly — no DB call, runs fine under Next.js 16's Node-runtime `proxy.ts`. |
| Sign-in | `signIn("credentials", ...)` from `next-auth/react`, called from a client component | Unaffected by v4 vs v5 — this part of the original plan was already correct. |
| Sign-up + auto-login | Server Action creates the user only; the **client** calls `signIn()` itself right after | v4 limitation: `next-auth/react`'s `signIn`/`signOut` only work in the browser. There's no server-callable equivalent like v5's. So the mutation (create user) and the session creation (sign in) are two sequential client-driven steps instead of one server-side step. |
| Sign-out | `signOut()` from `next-auth/react`, called directly from the Sidebar (already a client component) | Same v4 limitation. No `logout` Server Action exists — it would have nothing to do that the client function doesn't already do. |
| `SessionProvider` | Not used | Only needed if something calls the `useSession()` hook. Nothing here does — the Sidebar receives `user` as a prop from the server layout, and `signIn`/`signOut` work without a provider. Don't add it speculatively. |
| Password hashing | `bcryptjs` | Pure JS, no native build step on Vercel. |
| Validation | `zod`, applied both in the Server Action **and** inside `authorize()` | `authorize()` receives unvalidated external input too — code-standards.md's "validate unknown input at the boundary" applies there as much as to the Server Action. |
| Type augmentation | `types/next-auth.d.ts` | Under `strict` TS, `session.user.id` / `token.id` don't exist on v4's default types without this. |
| Route protection file name | `proxy.ts` | Next.js 16 convention (`middleware.ts` is deprecated, not removed — using the new name avoids the deprecation warning and a later forced migration). |
| Auth pages | `app/(auth)/sign-in/` + `app/(auth)/sign-up/` | Unchanged — route group keeps these out of the dashboard layout. |
| Dashboard layout | `app/(dashboard)/layout.tsx` with sidebar | Unchanged. |

---

## Execution Order

This phase is two separable units, not one — auth has nothing to do with
sidebar/layout chrome, and `ai-workflow-rules.md` says not to combine unrelated
boundaries in one step. Build and verify in this order:

- **2A — Auth core**: steps 1–11. Verify end-to-end (sign up, sign in, sign
  out, redirect behavior) before moving on.
- **2B — Layout shell**: steps 12–14. Depends on 2A only for `getServerSession`
  and `signOut` being available to wire in.

---

## Phase 2A — Auth Core

### 1. Install Dependencies

```bash
pnpm add next-auth zod bcryptjs
pnpm add -D @types/bcryptjs
```

No adapter package. Installing `next-auth` with no version pin pulls the
current `latest` tag — after install, run `pnpm list next-auth` and confirm
it resolved to a `4.x` version, not something else.

### 2. Environment Variables

Add to `.env`:

```bash
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
```

v4 uses `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — **not** `AUTH_SECRET` / `AUTH_URL`
(those shorter names are v5-only aliases and won't be read by v4). When this
gets deployed, set `NEXTAUTH_URL` to the production URL in Vercel's
environment variables — v4 doesn't reliably auto-infer it the way v5 does.

### 3. Type Augmentation — `types/next-auth.d.ts`

```ts
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
  }
}
```

### 4. Auth.js Configuration — `lib/auth.ts`

```ts
import { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { SignInSchema } from "@/lib/zod/auth"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = SignInSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })
        if (!user?.password) return null

        const isValid = await bcrypt.compare(parsed.data.password, user.password)
        if (!isValid) return null

        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      return session
    },
  },
}
```

Note the `authorize` function returns `null` for *both* "no such user" and
"wrong password" — never distinguish the two in the error, or it becomes an
email-enumeration channel.

### 5. Auth.js API Route — `app/api/auth/[...nextauth]/route.ts`

```ts
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

### 6. Zod Schemas — `lib/zod/auth.ts`

Unchanged from the original plan:

```ts
import { z } from "zod"

export const SignUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
})

export const SignInSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

export type SignUpInput = z.infer<typeof SignUpSchema>
export type SignInInput = z.infer<typeof SignInSchema>
```

### 7. Server Action — `app/actions/auth.ts`

Only **one** action now — `signup`. It's a pure DB mutation; it does not call
`signIn()` (it can't, from server code, in v4).

```ts
"use server"

import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { SignUpSchema } from "@/lib/zod/auth"

export async function signup(formData: FormData) {
  const parsed = SignUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return {
      success: false as const,
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })
  if (existing) {
    return { success: false as const, error: "Email already in use" }
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10)

  try {
    await prisma.user.create({
      data: { name: parsed.data.name, email: parsed.data.email, password: hashed },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { success: false as const, error: "Email already in use" }
    }
    throw err
  }

  return { success: true as const }
}
```

The `try/catch` on `P2002` covers the race where two signups for the same
email land between the `findUnique` check and the `create()` call — the
`@unique` constraint on `email` (Phase 1 schema) catches it at the DB level,
and this turns that into the same clean error shape instead of a raw Prisma
error reaching the client.

### 8. Sign-In Page

#### `app/(auth)/sign-in/page.tsx` — Server Component wrapper

Renders `<SignInForm />` with the auth card layout (brand, tagline, form).

#### `app/(auth)/sign-in/sign-in-form.tsx` — Client Component

- `"use client"`
- Fields: email, password
- On submit: `signIn("credentials", { email, password, redirect: false })`
  - Success → `router.push("/")`
  - Failure → show inline error
- Client-side Zod validation before submit
- Link to sign-up page
- If the URL has `?created=1` (see step 9), show "Account created — sign in
  below" above the form

This page is identical in spirit to the original draft — sign-in was never
affected by the v4/v5 difference.

### 9. Sign-Up Page

#### `app/(auth)/sign-up/page.tsx` — Server Component wrapper

Renders `<SignUpForm />`.

#### `app/(auth)/sign-up/sign-up-form.tsx` — Client Component

This is the one place the v4 limitation actually changes the shape of the
code. Two sequential async calls (create user, then sign in) don't fit
`useActionState`'s single-dispatch model cleanly, so this uses a plain async
handler that calls the Server Action directly (Server Actions are callable as
normal functions, not only via `<form action={...}>`):

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { signup } from "@/app/actions/auth"

export function SignUpForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)

    const result = await signup(formData)
    if (!result.success) {
      setError(result.error)
      setPending(false)
      return
    }

    const signInResult = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    })

    if (signInResult?.error) {
      // Account was created but auto-login failed for some reason — don't
      // strand the user on a broken page, send them to sign in manually.
      router.push("/sign-in?created=1")
      return
    }

    router.push("/")
  }

  return <form action={handleSubmit}>{/* name, email, password fields */}</form>
}
```

- Displays `result.fieldErrors` next to the relevant inputs
- Displays `result.error` (e.g. "Email already in use") as a general error
- Links to sign-in page

### 10. Auth Layout — `app/(auth)/layout.tsx`

Unchanged — minimal centered layout, no sidebar, theme toggle in the corner.

### 11. Route Protection — `proxy.ts`

```ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const publicPaths = ["/sign-in", "/sign-up"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicPath = publicPaths.includes(pathname)

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  if (token && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

The `matcher` already excludes everything under `/api`, including
`/api/auth/*` — that route never reaches this function at all, so there's no
need to special-case it in `publicPaths`.

**Stop here and verify all of 2A** (checks 1–8 in the Verification table)
before starting 2B.

---

## Phase 2B — Layout Shell

### 12. Sidebar Component — `components/sidebar.tsx`

Client component implementing the prototype's sidebar layout:

- **Desktop:** fixed left sidebar, nav links with Lucide icons
- **Mobile:** top bar (brand + hamburger) → slide-in drawer with backdrop
- **Nav items:** Dashboard (`layout-dashboard`) → `/`, Plan (`calendar-days`)
  → `/plan`, Dishes (`utensils`) → `/dishes`, Shopping list
  (`shopping-cart`) → `/shopping-list`, History (`history`) → `/history`
- **Active state:** highlight current route via `usePathname()`
- **Footer:** theme toggle, user avatar initial + name, sign-out button —
  `onClick={() => signOut({ callbackUrl: "/sign-in" })}`, imported directly
  from `next-auth/react`. No Server Action involved.
- **Mobile drawer:** full-height overlay from the left, dimmed backdrop,
  closes on backdrop click or Escape. Double-check it doesn't pick up rounded
  corners from a default shadcn `Sheet` — `--radius: 0` applies here too.
- Receives `user: { name?: string | null; email?: string | null }` as a prop

### 13. Dashboard Layout — `app/(dashboard)/layout.tsx`

```tsx
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { Sidebar } from "@/components/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <div className="flex">
      <Sidebar user={session!.user} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

`session!` is safe here specifically — `proxy.ts` already guarantees a
session exists for any route reaching this layout.

### 14. Root Page — `app/page.tsx`

```tsx
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  return <h1>Good morning, {session?.user?.name}</h1>
}
```

Server Component; placeholder for the full dashboard in Phase 5.

### 15. `app/layout.tsx`

No changes needed beyond what's already there (ThemeProvider, Inter font,
Geist Mono). This is a good moment to close the open item in
`ui-context.md`'s Typography section — confirm Inter is what's already wired
here and update that doc to stop flagging it as unresolved.

---

## Files

### Create

| File | Purpose |
|---|---|
| `lib/auth.ts` | Auth.js v4 configuration (Credentials provider, JWT callbacks — no adapter) |
| `lib/zod/auth.ts` | Zod schemas for sign-in and sign-up |
| `types/next-auth.d.ts` | Module augmentation — adds `id` to `Session.user` / `JWT` |
| `app/api/auth/[...nextauth]/route.ts` | Auth.js route handler |
| `app/actions/auth.ts` | Server Action: `signup` (user creation only — no `logout` action) |
| `app/(auth)/layout.tsx` | Minimal layout for auth pages |
| `app/(auth)/sign-in/page.tsx` | Sign-in page — Server Component wrapper |
| `app/(auth)/sign-in/sign-in-form.tsx` | Sign-in form — Client Component |
| `app/(auth)/sign-up/page.tsx` | Sign-up page — Server Component wrapper |
| `app/(auth)/sign-up/sign-up-form.tsx` | Sign-up form — Client Component, handles create-then-sign-in sequencing |
| `proxy.ts` | Route protection via `getToken()` |
| `components/sidebar.tsx` | Sidebar navigation — Client Component, calls `signOut()` directly |
| `app/(dashboard)/layout.tsx` | Dashboard layout with sidebar shell |
| `app/(dashboard)/page.tsx` or `app/page.tsx` | Placeholder dashboard page (greeting) — confirm which per existing routing |

### Modify

| File | Change |
|---|---|
| `.env` | Add `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |

---

## Verification

| # | Check | How |
|---|---|---|
| 1 | `pnpm install` | No errors |
| 2 | `pnpm run typecheck` | Passes (in particular, confirms `types/next-auth.d.ts` is picked up) |
| 3 | `pnpm run build` | Passes |
| 4 | Sign up | Visit `/sign-up`, create account → auto-redirect to `/` |
| 5 | Sign up, auto-login failure path | Temporarily force `signIn()` to fail and confirm it lands on `/sign-in?created=1` instead of a broken state |
| 6 | Sign in | Visit `/sign-in`, enter credentials → redirect to `/` |
| 7 | Sign out | Click sign out in sidebar → redirect to `/sign-in` |
| 8 | Route protection (unauthenticated) | Visit `/` while logged out → redirect to `/sign-in` |
| 9 | Route protection (authenticated) | Visit `/sign-in` while logged in → redirect to `/` |
| 10 | Duplicate email | Sign up twice with the same email → "Email already in use", no raw Prisma error |
| 11 | Sidebar renders | Desktop: fixed left sidebar with nav links, theme toggle, user info |
| 12 | Mobile responsive | Below ~860px: top bar with hamburger → slide-in drawer |
| 13 | Theme toggle | Persists across navigation |
| 14 | `Account`/`Session` tables | Confirm they stay empty after sign-up/sign-in — expected, not a bug |

---

## Deferred to Phase 3+

- Full dashboard content (summary cards, quick links) — Phase 5
- Dish library pages — Phase 3
- Plan generation and viewing — Phase 5
- Plan editing and shopping list — Phase 6
- Plan history and account settings — Phase 7
- Revisit whether to add an adapter at all if/when OAuth providers are ever introduced — not needed for v1's Credentials-only scope