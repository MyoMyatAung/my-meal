import { z } from "zod"
import { PasswordSchema } from "@/lib/zod/auth"

export const UpdateNameSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
})

export const UpdatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: PasswordSchema,
})
