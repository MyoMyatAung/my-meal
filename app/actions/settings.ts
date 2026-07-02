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
