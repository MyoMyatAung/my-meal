"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logError } from "@/lib/log-error"
import { GeneratePlanSchema, SwapDishSchema } from "@/lib/zod/plan"
import { Prisma } from "@prisma/client"
import { generatePlan, PreFlightGateError } from "@/lib/planner/generate"
import type { PlannerDish } from "@/lib/planner/types"
import { parseCalendarDate } from "@/lib/utils/date"
import {
  computeEntryWarnings,
  type WarningEntry,
} from "@/lib/planner/edit-warnings"
import { diffShoppingList } from "@/lib/utils/shopping-list-diff"

async function getUserId() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

export async function generatePlanAction({
  startDate,
  durationDays,
}: {
  startDate: string
  durationDays: number
}) {
  try {
    const userId = await getUserId()

    const parsed = GeneratePlanSchema.safeParse({ startDate, durationDays })
    if (!parsed.success) {
      return { success: false as const, error: "Invalid plan parameters" }
    }

    const dishes = await prisma.dish.findMany({
      where: { userId, isArchived: false },
      include: {
        flavors: { select: { flavor: { select: { name: true } } } },
        ingredients: {
          select: { ingredient: { select: { id: true, name: true } } },
        },
        pairingsAsA: { select: { dishBId: true } },
        pairingsAsB: { select: { dishAId: true } },
      },
    })

    const plannerDishes: PlannerDish[] = dishes.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      mealTime: d.mealTime,
      isSpecial: d.isSpecial,
      flavors: d.flavors.map((df) => df.flavor.name),
      ingredientNames: d.ingredients.map((di) => di.ingredient.name),
      pairedDishIds: [
        ...d.pairingsAsA.map((p) => p.dishBId),
        ...d.pairingsAsB.map((p) => p.dishAId),
      ],
    }))

    const ingredientMap = new Map<string, string>()
    for (const d of dishes) {
      for (const di of d.ingredients) {
        ingredientMap.set(di.ingredient.name, di.ingredient.id)
      }
    }

    let output
    try {
      output = generatePlan({
        dishes: plannerDishes,
        startDate: parseCalendarDate(parsed.data.startDate),
        durationDays: parsed.data.durationDays,
      })
    } catch (e) {
      if (e instanceof PreFlightGateError) {
        return { success: false as const, error: e.errors.join("; ") }
      }
      throw e
    }

    const lastEntry = output.entries[output.entries.length - 1]

    const plan = await prisma.$transaction(async (tx) => {
      const createdPlan = await tx.mealPlan.create({
        data: {
          startDate: parseCalendarDate(parsed.data.startDate),
          endDate: lastEntry.date,
          warnings: output.warnings as unknown as Prisma.InputJsonValue,
          userId,
        },
      })

      for (const entry of output.entries) {
        const dbEntry = await tx.mealPlanEntry.create({
          data: {
            date: entry.date,
            mealTime: entry.mealTime,
            mealPlanId: createdPlan.id,
          },
        })

        if (entry.dishes.length > 0) {
          await tx.mealPlanEntryDish.createMany({
            data: entry.dishes.map((dish) => ({
              entryId: dbEntry.id,
              dishId: dish.dishId,
              sortOrder: dish.sortOrder,
            })),
          })
        }
      }

      const shoppingItemsData = output.shoppingItems
        .map((item) => {
          const ingredientId = ingredientMap.get(item.ingredientName)
          if (!ingredientId) return null
          return {
            mealPlanId: createdPlan.id,
            ingredientId,
            dishName: item.dishName,
          }
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)

      if (shoppingItemsData.length > 0) {
        await tx.shoppingListItem.createMany({ data: shoppingItemsData })
      }

      return createdPlan
    })

    return { success: true as const, data: { planId: plan.id } }
  } catch (e) {
    logError("generatePlanAction", e)
    return { success: false as const, error: "Failed to generate plan" }
  }
}

async function findPlanWithWarnings(
  where: Prisma.MealPlanWhereInput,
  orderBy?: Prisma.MealPlanOrderByWithRelationInput
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
                  flavors: {
                    select: { flavor: { select: { name: true } } },
                  },
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
    date: entry.date,
    mealTime: entry.mealTime,
    dishes: entry.dishes.map((entryDish) => ({
      dishId: entryDish.dish.id,
      dishName: entryDish.dish.name,
      flavors: entryDish.dish.flavors.map((flavorLink) => flavorLink.flavor.name),
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
        (plan.endDate.getTime() - plan.startDate.getTime()) / 86_400_000
      ) + 1,
    ingredientCount: plan._count.shoppingItems,
  }))
}

export async function getSwappableDishes(mealTime: "Breakfast" | "Lunch") {
  try {
    const userId = await getUserId()
    const dishes = await prisma.dish.findMany({
      where: { userId, isArchived: false, mealTime },
      select: {
        id: true,
        name: true,
        isSpecial: true,
      },
      orderBy: { name: "asc" },
    })

    return { success: true as const, data: { dishes } }
  } catch (e) {
    logError("getSwappableDishes", e)
    return { success: false as const, error: "Failed to fetch dishes" }
  }
}

export async function swapDishAction(input: {
  entryDishId: string
  newDishId: string
}) {
  try {
    const userId = await getUserId()

    const parsed = SwapDishSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false as const, error: "Invalid swap request" }
    }

    const entryDish = await prisma.mealPlanEntryDish.findFirst({
      where: {
        id: parsed.data.entryDishId,
        entry: { mealPlan: { userId } },
      },
      include: {
        entry: {
          include: {
            dishes: true,
          },
        },
      },
    })

    if (!entryDish) {
      return { success: false as const, error: "Slot not found" }
    }

    const newDish = await prisma.dish.findFirst({
      where: {
        id: parsed.data.newDishId,
        userId,
        isArchived: false,
      },
    })

    if (!newDish) {
      return { success: false as const, error: "Dish not found" }
    }

    if (newDish.mealTime !== entryDish.entry.mealTime) {
      return {
        success: false as const,
        error: "Dish must match this slot's meal time",
      }
    }

    const alreadyInEntry = entryDish.entry.dishes.some(
      (dish) => dish.id !== entryDish.id && dish.dishId === newDish.id
    )

    if (alreadyInEntry) {
      return { success: false as const, error: "That dish is already in this meal" }
    }

    const mealPlanId = entryDish.entry.mealPlanId

    await prisma.$transaction(async (tx) => {
      await tx.mealPlanEntryDish.update({
        where: { id: entryDish.id },
        data: { dishId: newDish.id },
      })

      const allEntryDishes = await tx.mealPlanEntryDish.findMany({
        where: { entry: { mealPlanId } },
        select: { dishId: true },
      })

      const currentDishIds = [...new Set(allEntryDishes.map((dish) => dish.dishId))]

      const dishesWithIngredients = await tx.dish.findMany({
        where: { id: { in: currentDishIds } },
        select: {
          ingredients: {
            select: { ingredientId: true },
          },
        },
      })

      const requiredIngredientIds = new Set(
        dishesWithIngredients.flatMap((dish) =>
          dish.ingredients.map((ingredient) => ingredient.ingredientId)
        )
      )

      const existingItems = await tx.shoppingListItem.findMany({
        where: { mealPlanId },
        select: { id: true, ingredientId: true },
      })

      const { toCreateIngredientIds, toDeleteItemIds } = diffShoppingList(
        requiredIngredientIds,
        existingItems
      )

      if (toDeleteItemIds.length > 0) {
        await tx.shoppingListItem.deleteMany({
          where: { id: { in: toDeleteItemIds } },
        })
      }

      if (toCreateIngredientIds.length > 0) {
        await tx.shoppingListItem.createMany({
          data: toCreateIngredientIds.map((ingredientId) => ({
            mealPlanId,
            ingredientId,
            isChecked: false,
            dishName: newDish.name,
          })),
        })
      }
    })

    return { success: true as const, data: { entryDishId: entryDish.id } }
  } catch (e) {
    logError("swapDishAction", e)
    return { success: false as const, error: "Failed to swap dish" }
  }
}

export async function getDishCounts() {
  const userId = await getUserId()

  const [breakfast, lunch, main, sideOrSoup] = await Promise.all([
    prisma.dish.count({
      where: { userId, isArchived: false, mealTime: "Breakfast" },
    }),
    prisma.dish.count({
      where: { userId, isArchived: false, mealTime: "Lunch" },
    }),
    prisma.dish.count({
      where: { userId, isArchived: false, mealTime: "Lunch", category: "MAIN" },
    }),
    prisma.dish.count({
      where: {
        userId,
        isArchived: false,
        mealTime: "Lunch",
        category: { in: ["SIDE", "SOUP"] },
      },
    }),
  ])

  return { breakfast, lunch, main, sideOrSoup }
}
