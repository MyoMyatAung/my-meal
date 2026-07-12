"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { logError } from "@/lib/log-error"
import { ToggleShoppingItemSchema } from "@/lib/zod/shopping-list"

async function getUserId() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

export async function getCurrentShoppingList() {
  const userId = await getUserId()

  return prisma.mealPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shoppingItems: {
        select: {
          id: true,
          isChecked: true,
          ingredient: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          ingredient: {
            name: "asc",
          },
        },
      },
    },
  })
}

export async function toggleShoppingItemAction(input: {
  itemId: string
  isChecked: boolean
}) {
  try {
    const userId = await getUserId()

    const parsed = ToggleShoppingItemSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false as const, error: "Invalid input" }
    }

    const item = await prisma.shoppingListItem.findFirst({
      where: {
        id: parsed.data.itemId,
        mealPlan: { userId },
      },
    })

    if (!item) {
      return { success: false as const, error: "Item not found" }
    }

    await prisma.shoppingListItem.update({
      where: { id: parsed.data.itemId },
      data: { isChecked: parsed.data.isChecked },
    })

    return { success: true as const, data: { itemId: parsed.data.itemId } }
  } catch (e) {
    logError("toggleShoppingItemAction", e)
    return { success: false as const, error: "Failed to update item" }
  }
}
