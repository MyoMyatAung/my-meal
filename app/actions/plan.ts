"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { GeneratePlanSchema } from "@/lib/zod/plan"
import { Prisma } from "@prisma/client"
import { generatePlan, PreFlightGateError } from "@/lib/planner/generate"
import type { PlannerDish } from "@/lib/planner/types"
import { parseCalendarDate } from "@/lib/utils/date"

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
      },
    })

    const plannerDishes: PlannerDish[] = dishes.map((d) => ({
      id: d.id,
      name: d.name,
      mealTime: d.mealTime,
      isSpecial: d.isSpecial,
      flavors: d.flavors.map((df) => df.flavor.name),
      ingredientNames: d.ingredients.map((di) => di.ingredient.name),
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
  } catch {
    return { success: false as const, error: "Failed to generate plan" }
  }
}

export async function getCurrentPlan() {
  const userId = await getUserId()

  const plan = await prisma.mealPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      entries: {
        include: {
          dishes: {
            include: {
              dish: {
                select: { id: true, name: true, category: true, isSpecial: true },
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

  return plan
}

export async function getDishCounts() {
  const userId = await getUserId()

  const [breakfast, lunch] = await Promise.all([
    prisma.dish.count({
      where: { userId, isArchived: false, mealTime: "Breakfast" },
    }),
    prisma.dish.count({
      where: { userId, isArchived: false, mealTime: "Lunch" },
    }),
  ])

  return { breakfast, lunch }
}
