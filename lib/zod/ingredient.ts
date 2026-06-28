import { z } from "zod"

export const IngredientSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
})

export type IngredientInput = z.infer<typeof IngredientSchema>
