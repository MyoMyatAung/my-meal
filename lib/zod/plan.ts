import { z } from "zod"

export const GeneratePlanSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  durationDays: z
    .number()
    .int()
    .min(1, "Duration must be at least 1 day")
    .max(365, "Duration cannot exceed 365 days")
    .default(14),
})

export type GeneratePlanInput = z.infer<typeof GeneratePlanSchema>
