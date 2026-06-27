# Phase 1 — Foundation: Prisma

## Goal

Initialize Prisma with the full database schema (Auth.js models + domain models), run the initial migration against the Neon database, and create the Prisma client singleton.

## Neon Database

| Field | Value |
|---|---|
| Project | `my-meal-db` (`frosty-sky-56033851`) |
| Branch | `production` (`br-floral-wind-aohzf9ww`) |
| Database | `neondb` |
| Status | Empty — no tables yet |

---

## Steps

### 1. Install Prisma

```bash
pnpm add -D prisma
pnpm add @prisma/client
```

### 2. Create `.env` with DATABASE_URL

Create `.env` at the project root:

```
DATABASE_URL="postgresql://neondb_owner:npg_gbWI4T0ksqeK@ep-patient-hat-aobkuwhr-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

Verify `.env` is in `.gitignore`.

### 3. Initialize Prisma

```bash
npx prisma init
```

This creates `prisma/schema.prisma`. We overwrite it with the full schema below.

### 4. Write `prisma/schema.prisma`

#### Auth.js Models

Required by `@auth/prisma-adapter`. Even if some tables are unused with JWT strategy in v1, they must exist for the adapter to work.

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  password      String?   // For Credentials provider — not managed by Auth.js
  accounts      Account[]
  sessions      Session[]
  dishes        Dish[]
  ingredients   Ingredient[]
  mealPlans     MealPlan[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
}
```

#### Domain Models

```prisma
model Ingredient {
  id           String           @id @default(cuid())
  name         String
  userId       String
  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  dishes       DishIngredient[]
  shoppingItems ShoppingListItem[]

  @@unique([name, userId])
}

model Dish {
  id           String              @id @default(cuid())
  name         String
  category     String?             // e.g. "pasta", "salad", "soup" — freeform per user
  mealTime     MealTime            // Breakfast or Lunch — exclusive
  isSpecial    Boolean             @default(false)
  isArchived   Boolean             @default(false)
  userId       String
  user         User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  flavors      DishFlavor[]
  ingredients  DishIngredient[]
  planEntries  MealPlanEntryDish[]
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
}

model DishFlavor {
  id     String @id @default(cuid())
  dishId String
  dish   Dish   @relation(fields: [dishId], references: [id], onDelete: Cascade)
  flavor String // e.g. "spicy", "sweet", "umami"

  @@unique([dishId, flavor])
}

model DishIngredient {
  id           String     @id @default(cuid())
  dishId       String
  dish         Dish       @relation(fields: [dishId], references: [id], onDelete: Cascade)
  ingredientId String
  ingredient   Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Cascade)

  @@unique([dishId, ingredientId])
}

model MealPlan {
  id            String              @id @default(cuid())
  startDate     DateTime
  endDate       DateTime
  userId        String
  user          User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries       MealPlanEntry[]
  shoppingItems ShoppingListItem[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}

model MealPlanEntry {
  id         String               @id @default(cuid())
  date       DateTime             // the specific day
  mealTime   MealTime             // Breakfast or Lunch
  mealPlanId String
  mealPlan   MealPlan             @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  dishes     MealPlanEntryDish[]
  createdAt  DateTime             @default(now())

  @@unique([mealPlanId, date, mealTime])
}

model MealPlanEntryDish {
  id        String         @id @default(cuid())
  entryId   String
  entry     MealPlanEntry  @relation(fields: [entryId], references: [id], onDelete: Cascade)
  dishId    String
  dish      Dish           @relation(fields: [dishId], references: [id], onDelete: Cascade)
  sortOrder Int            @default(0) // for lunch with 2-3 dishes, controls display order
}

model ShoppingListItem {
  id           String     @id @default(cuid())
  mealPlanId   String
  mealPlan     MealPlan   @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  ingredientId String
  ingredient   Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Cascade)
  isChecked    Boolean    @default(false)
  dishName     String     // snapshot: dish name at generation time

  @@unique([mealPlanId, ingredientId])
}

enum MealTime {
  Breakfast
  Lunch
}
```

#### Design Decisions

| Decision | Rationale |
|---|---|
| `password` on `User` | Auth.js doesn't manage Credentials passwords — we add it ourselves |
| `Account` + `Session` tables | Required by `@auth/prisma-adapter` even if unused with JWT strategy in v1 |
| `DishFlavor` join table | Flavors are multi-select; a dish can have many flavors |
| `DishIngredient` join table | Ingredients are per-user master list, chosen via combobox — never free text |
| `@@unique([name, userId])` on `Ingredient` | Prevents duplicate ingredient names per user |
| `@@unique([dishId, flavor])` on `DishFlavor` | Prevents duplicate flavors on one dish |
| `@@unique([mealPlanId, date, mealTime])` on `MealPlanEntry` | One entry per day per meal time per plan |
| `@@unique([mealPlanId, ingredientId])` on `ShoppingListItem` | Deduplicates ingredients across dishes in a plan |
| `sortOrder` on `MealPlanEntryDish` | Lunch has 2-3 dishes — order matters for display |
| `dishName` snapshot on `ShoppingListItem` | Invariant 3: past plans retain original dish names even if dishes are later edited/archived |
| `onDelete: Cascade` throughout | Deleting a user/plan cascades cleanly; domain ownership is total |
| `createdAt` / `updatedAt` on major models | Standard audit fields |

### 5. Run Initial Migration

```bash
npx prisma migrate dev --name init
```

### 6. Create `lib/db.ts`

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 7. Verify

| Check | Command |
|---|---|
| Migration applied | `npx prisma migrate status` |
| Client generated | `npx prisma generate` |
| TypeScript compiles | `npm run typecheck` |
| Build passes | `npm run build` |
| Tables exist | `npx prisma db pull` or check Neon console |

---

## Files

| File | Action |
|---|---|
| `.env` | Create — `DATABASE_URL` |
| `prisma/schema.prisma` | Create — full schema |
| `prisma/migrations/` | Created by `prisma migrate dev` |
| `lib/db.ts` | Create — Prisma client singleton |
| `package.json` | Modified — `prisma` + `@prisma/client` added |

## Deferred to Phase 2+

- `AUTH_SECRET` — not needed until Auth.js setup
- `lib/auth.ts` — Auth.js configuration
- No UI changes — purely database foundation
