"use server"

import { Prisma } from "@prisma/client"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { IngredientSchema } from "@/lib/zod/ingredient"

async function getUserId() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

export type IngredientResult =
  | { success: true; data: { ingredient: Prisma.IngredientGetPayload<{}>; reused: boolean } }
  | { success: true; data: { ingredientId: string } }
  | { success: false; error: string }

export async function getIngredients(search?: string) {
  try {
    const userId = await getUserId()

    const where: Prisma.IngredientWhereInput = {
      userId,
      ...(search
        ? { name: { contains: search, mode: "insensitive" } }
        : {}),
    }

    const ingredients = await prisma.ingredient.findMany({
      where,
      orderBy: { name: "asc" },
    })

    return { success: true as const, data: { ingredients } }
  } catch {
    return { success: false as const, error: "Failed to fetch ingredients" }
  }
}

export async function createIngredient(formData: { name: string }) {
  try {
    const userId = await getUserId()
    const parsed = IngredientSchema.safeParse(formData)
    if (!parsed.success) {
      return { success: false as const, error: "Invalid ingredient name" }
    }

    const existing = await prisma.ingredient.findFirst({
      where: {
        userId,
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
    })

    if (existing) {
      return {
        success: true as const,
        data: { ingredient: existing, reused: true },
      }
    }

    const ingredient = await prisma.ingredient.create({
      data: { name: parsed.data.name, userId },
    })

    return {
      success: true as const,
      data: { ingredient, reused: false },
    }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { success: false as const, error: "Ingredient already exists" }
    }
    return { success: false as const, error: "Failed to create ingredient" }
  }
}

export async function updateIngredient(
  ingredientId: string,
  formData: { name: string },
) {
  try {
    const userId = await getUserId()
    const parsed = IngredientSchema.safeParse(formData)
    if (!parsed.success) {
      return { success: false as const, error: "Invalid ingredient name" }
    }

    const existing = await prisma.ingredient.findFirst({
      where: {
        userId,
        name: { equals: parsed.data.name, mode: "insensitive" },
        id: { not: ingredientId },
      },
    })

    if (existing) {
      return {
        success: false as const,
        error: "An ingredient with that name already exists",
      }
    }

    const ingredient = await prisma.ingredient.update({
      where: { id: ingredientId },
      data: { name: parsed.data.name },
    })

    return { success: true as const, data: { ingredient } }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { success: false as const, error: "Ingredient already exists" }
    }
    return { success: false as const, error: "Failed to update ingredient" }
  }
}

export async function deleteIngredient(ingredientId: string) {
  try {
    const userId = await getUserId()

    const usedByActiveDish = await prisma.dishIngredient.findFirst({
      where: {
        ingredientId,
        dish: { userId, isArchived: false },
      },
    })

    if (usedByActiveDish) {
      return {
        success: false as const,
        error: "Ingredient is used by an active dish",
      }
    }

    await prisma.ingredient.delete({ where: { id: ingredientId } })

    return { success: true as const, data: { ingredientId } }
  } catch {
    return { success: false as const, error: "Failed to delete ingredient" }
  }
}
