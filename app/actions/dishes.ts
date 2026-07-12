"use server"

import { Prisma, type Category } from "@prisma/client"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logError } from "@/lib/log-error"
import { DishSchema, DishFilterSchema } from "@/lib/zod/dish"

const dishInclude = {
  flavors: { select: { id: true, flavor: { select: { id: true, name: true } } } },
  ingredients: {
    select: {
      id: true,
      ingredient: { select: { id: true, name: true } },
    },
  },
  pairingsAsA: {
    select: { dishB: { select: { id: true, name: true, category: true } } },
  },
  pairingsAsB: {
    select: { dishA: { select: { id: true, name: true, category: true } } },
  },
} satisfies Prisma.DishInclude

type DishWithRawPairings = Prisma.DishGetPayload<{ include: typeof dishInclude }>

export type DishWithRelations = Omit<
  DishWithRawPairings,
  "pairingsAsA" | "pairingsAsB"
> & {
  pairedDishes: { id: string; name: string; category: Category }[]
}

function withPairedDishes(dish: DishWithRawPairings): DishWithRelations {
  const { pairingsAsA, pairingsAsB, ...rest } = dish
  return {
    ...rest,
    pairedDishes: [
      ...pairingsAsA.map((p) => p.dishB),
      ...pairingsAsB.map((p) => p.dishA),
    ],
  }
}

class PairingValidationError extends Error {}

async function getUserId() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

function dedupeFlavorsCaseInsensitive(flavors: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const f of flavors) {
    const lower = f.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      result.push(f)
    }
  }
  return result
}

/**
 * Symmetric pairing sync: one canonical DishPairing row per unordered pair
 * (dishAId < dishBId), diffed against the dish's desired pairing set.
 * Rejects any target that isn't the user's own, Lunch-only dish.
 */
async function syncDishPairings(
  tx: Prisma.TransactionClient,
  userId: string,
  dishId: string,
  targetIds: string[],
): Promise<void> {
  const uniqueTargetIds = [...new Set(targetIds)].filter((id) => id !== dishId)

  if (uniqueTargetIds.length > 0) {
    const validTargets = await tx.dish.findMany({
      where: { id: { in: uniqueTargetIds }, userId, mealTime: "Lunch" },
      select: { id: true },
    })
    if (validTargets.length !== uniqueTargetIds.length) {
      throw new PairingValidationError("One or more paired dishes are invalid")
    }
  }

  const existing = await tx.dishPairing.findMany({
    where: { OR: [{ dishAId: dishId }, { dishBId: dishId }] },
  })

  const existingOtherIds = new Map(
    existing.map((row) => [
      row.dishAId === dishId ? row.dishBId : row.dishAId,
      row.id,
    ]),
  )

  const desiredSet = new Set(uniqueTargetIds)

  const toDeleteIds = existing
    .filter((row) => {
      const otherId = row.dishAId === dishId ? row.dishBId : row.dishAId
      return !desiredSet.has(otherId)
    })
    .map((row) => row.id)

  const toCreateIds = uniqueTargetIds.filter((id) => !existingOtherIds.has(id))

  if (toDeleteIds.length > 0) {
    await tx.dishPairing.deleteMany({ where: { id: { in: toDeleteIds } } })
  }

  if (toCreateIds.length > 0) {
    await tx.dishPairing.createMany({
      data: toCreateIds.map((targetId) => {
        const [dishAId, dishBId] = [dishId, targetId].sort()
        return { dishAId, dishBId }
      }),
    })
  }
}

export async function getFlavors(search?: string) {
  try {
    const userId = await getUserId()

    const flavors = await prisma.flavor.findMany({
      where: {
        userId,
        ...(search
          ? { name: { contains: search, mode: "insensitive" } }
          : {}),
      },
      orderBy: { name: "asc" },
    })

    return { success: true as const, data: { flavors } }
  } catch (e) {
    logError("getFlavors", e)
    return { success: false as const, error: "Failed to fetch flavors" }
  }
}

export type DishResult =
  | {
      success: true
      data: {
        dishes: DishWithRelations[]
        total: number
        page: number
        pageSize: number
        totalPages: number
      }
    }
  | { success: true; data: { dish: DishWithRelations } }
  | { success: true; data: { dishId: string } }
  | { success: false; error: string }

export async function getDishes(filters?: {
  category?: string
  mealTime?: string
  search?: string
  page?: number
  pageSize?: number
}) {
  try {
    const userId = await getUserId()

    const parsed = DishFilterSchema.safeParse(filters ?? {})
    if (!parsed.success) {
      return { success: false as const, error: "Invalid filters" }
    }

    const { category, mealTime, search, page, pageSize } = parsed.data

    const where: Prisma.DishWhereInput = {
      userId,
      isArchived: false,
      ...(category ? { category } : {}),
      ...(mealTime ? { mealTime } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    }

    const skip = (page - 1) * pageSize

    // Run the count and the page fetch in parallel to minimize latency.
    const [total, dishes] = await Promise.all([
      prisma.dish.count({ where }),
      prisma.dish.findMany({
        where,
        include: dishInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return {
      success: true as const,
      data: {
        dishes: dishes.map(withPairedDishes),
        total,
        page,
        pageSize,
        totalPages,
      },
    }
  } catch (e) {
    logError("getDishes", e)
    return { success: false as const, error: "Failed to fetch dishes" }
  }
}

export async function getDishById(dishId: string) {
  try {
    const userId = await getUserId()

    const dish = await prisma.dish.findFirst({
      where: { id: dishId, userId },
      include: dishInclude,
    })

    if (!dish) {
      return { success: false as const, error: "Dish not found" }
    }

    return { success: true as const, data: { dish: withPairedDishes(dish) } }
  } catch (e) {
    logError("getDishById", e)
    return { success: false as const, error: "Failed to fetch dish" }
  }
}

export async function createDish(formData: {
  name: string
  category: string
  mealTime: string
  isSpecial?: boolean
  flavors?: string[]
  ingredientIds?: string[]
  pairedDishIds?: string[]
}) {
  try {
    const userId = await getUserId()

    const parsed = DishSchema.safeParse(formData)
    if (!parsed.success) {
      return { success: false as const, error: "Invalid dish data" }
    }

    const dedupedFlavors = dedupeFlavorsCaseInsensitive(parsed.data.flavors)

    const dish = await prisma.$transaction(async (tx) => {
      const created = await tx.dish.create({
        data: {
          name: parsed.data.name,
          category: parsed.data.category,
          mealTime: parsed.data.mealTime,
          isSpecial: parsed.data.isSpecial,
          userId,
          flavors: {
            create: await Promise.all(
              dedupedFlavors.map(async (flavorName) => {
                const flavor = await tx.flavor.upsert({
                  where: { name_userId: { name: flavorName, userId } },
                  update: {},
                  create: { name: flavorName, userId },
                })
                return { flavorId: flavor.id }
              }),
            ),
          },
          ingredients: {
            create: parsed.data.ingredientIds.map((ingredientId) => ({
              ingredientId,
            })),
          },
        },
      })

      await syncDishPairings(tx, userId, created.id, parsed.data.pairedDishIds)

      return tx.dish.findUniqueOrThrow({
        where: { id: created.id },
        include: dishInclude,
      })
    })

    return { success: true as const, data: { dish: withPairedDishes(dish) } }
  } catch (e) {
    logError("createDish", e)
    if (e instanceof PairingValidationError) {
      return { success: false as const, error: e.message }
    }
    return { success: false as const, error: "Failed to create dish" }
  }
}

export async function updateDish(
  dishId: string,
  formData: {
    name: string
    category: string
    mealTime: string
    isSpecial?: boolean
    flavors?: string[]
    ingredientIds?: string[]
    pairedDishIds?: string[]
  },
) {
  try {
    const userId = await getUserId()

    const existing = await prisma.dish.findFirst({
      where: { id: dishId, userId },
    })
    if (!existing) {
      return { success: false as const, error: "Dish not found" }
    }

    const parsed = DishSchema.safeParse(formData)
    if (!parsed.success) {
      return { success: false as const, error: "Invalid dish data" }
    }

    const dedupedFlavors = dedupeFlavorsCaseInsensitive(parsed.data.flavors)

    const dish = await prisma.$transaction(async (tx) => {
      await tx.dish.update({
        where: { id: dishId },
        data: {
          name: parsed.data.name,
          category: parsed.data.category,
          mealTime: parsed.data.mealTime,
          isSpecial: parsed.data.isSpecial,
          flavors: {
            deleteMany: {},
            create: await Promise.all(
              dedupedFlavors.map(async (flavorName) => {
                const flavor = await tx.flavor.upsert({
                  where: { name_userId: { name: flavorName, userId } },
                  update: {},
                  create: { name: flavorName, userId },
                })
                return { flavorId: flavor.id }
              }),
            ),
          },
          ingredients: {
            deleteMany: {},
            create: parsed.data.ingredientIds.map((ingredientId) => ({
              ingredientId,
            })),
          },
        },
      })

      await syncDishPairings(tx, userId, dishId, parsed.data.pairedDishIds)

      return tx.dish.findUniqueOrThrow({
        where: { id: dishId },
        include: dishInclude,
      })
    })

    return { success: true as const, data: { dish: withPairedDishes(dish) } }
  } catch (e) {
    logError("updateDish", e)
    if (e instanceof PairingValidationError) {
      return { success: false as const, error: e.message }
    }
    return { success: false as const, error: "Failed to update dish" }
  }
}

export async function deleteDish(dishId: string) {
  try {
    const userId = await getUserId()

    const existing = await prisma.dish.findFirst({
      where: { id: dishId, userId },
    })
    if (!existing) {
      return { success: false as const, error: "Dish not found" }
    }

    await prisma.dish.update({
      where: { id: dishId },
      data: { isArchived: true },
    })

    return { success: true as const, data: { dishId } }
  } catch (e) {
    logError("deleteDish", e)
    return { success: false as const, error: "Failed to delete dish" }
  }
}
