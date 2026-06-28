"use server"

import { Prisma } from "@prisma/client"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { DishSchema, DishFilterSchema } from "@/lib/zod/dish"

export type DishWithRelations = Prisma.DishGetPayload<{
  include: {
    flavors: { select: { id: true; flavor: { select: { id: true; name: true } } } }
    ingredients: {
      select: { id: true; ingredient: { select: { id: true; name: true } } }
    }
  }
}>

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
  } catch {
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
        include: {
          flavors: { select: { id: true, flavor: { select: { id: true, name: true } } } },
          ingredients: {
            select: {
              id: true,
              ingredient: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return {
      success: true as const,
      data: { dishes, total, page, pageSize, totalPages },
    }
  } catch {
    return { success: false as const, error: "Failed to fetch dishes" }
  }
}

export async function getDishById(dishId: string) {
  try {
    const userId = await getUserId()

    const dish = await prisma.dish.findFirst({
      where: { id: dishId, userId },
      include: {
        flavors: { select: { id: true, flavor: { select: { id: true, name: true } } } },
        ingredients: {
          select: {
            id: true,
            ingredient: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!dish) {
      return { success: false as const, error: "Dish not found" }
    }

    return { success: true as const, data: { dish } }
  } catch {
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
}) {
  try {
    const userId = await getUserId()

    const parsed = DishSchema.safeParse(formData)
    if (!parsed.success) {
      return { success: false as const, error: "Invalid dish data" }
    }

    const dedupedFlavors = dedupeFlavorsCaseInsensitive(parsed.data.flavors)

    const dish = await prisma.dish.create({
      data: {
        name: parsed.data.name,
        category: parsed.data.category,
        mealTime: parsed.data.mealTime,
        isSpecial: parsed.data.isSpecial,
        userId,
        flavors: {
          create: await Promise.all(
            dedupedFlavors.map(async (flavorName) => {
              const flavor = await prisma.flavor.upsert({
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
      include: {
        flavors: { select: { id: true, flavor: { select: { id: true, name: true } } } },
        ingredients: {
          select: {
            id: true,
            ingredient: { select: { id: true, name: true } },
          },
        },
      },
    })

    return { success: true as const, data: { dish } }
  } catch {
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

    const dish = await prisma.dish.update({
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
              const flavor = await prisma.flavor.upsert({
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
      include: {
        flavors: { select: { id: true, flavor: { select: { id: true, name: true } } } },
        ingredients: {
          select: {
            id: true,
            ingredient: { select: { id: true, name: true } },
          },
        },
      },
    })

    return { success: true as const, data: { dish } }
  } catch {
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
  } catch {
    return { success: false as const, error: "Failed to delete dish" }
  }
}
