import { z } from "zod"

export const GeneratePlanSchema = z.object({
  startDate: z.iso.date("Date must be a valid YYYY-MM-DD date"),
  durationDays: z
    .number()
    .int()
    .min(1, "Duration must be at least 1 day")
    .max(365, "Duration cannot exceed 365 days")
    .default(14),
})

export type GeneratePlanInput = z.infer<typeof GeneratePlanSchema>

export const SwapDishSchema = z.object({
  entryDishId: z.string().min(1),
  newDishId: z.string().min(1),
})

export type SwapDishInput = z.infer<typeof SwapDishSchema>
