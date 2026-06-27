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
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { success: false as const, error: "Email already in use" }
    }
    throw err
  }

  return { success: true as const }
}
