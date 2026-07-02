import { z } from "zod"

export const ToggleShoppingItemSchema = z.object({
  itemId: z.string().min(1),
  isChecked: z.boolean(),
})

export type ToggleShoppingItemInput = z.infer<typeof ToggleShoppingItemSchema>
