import { z } from "zod"
import { Category, MealTime } from "@prisma/client"

export const DishSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    category: z.nativeEnum(Category),
    mealTime: z.nativeEnum(MealTime),
    isSpecial: z.boolean().default(false),
    flavors: z
      .array(z.string().trim().min(1).max(50))
      .max(10)
      .default([]),
    ingredientIds: z
      .array(z.string().cuid())
      .max(20)
      .default([]),
  })
  .refine(
    (data) => !(data.mealTime === "Breakfast" && data.isSpecial),
    {
      message: "Special dish flag only applies to Lunch",
      path: ["isSpecial"],
    },
  )

export type DishInput = z.infer<typeof DishSchema>

export const DishFilterSchema = z.object({
  category: z.nativeEnum(Category).optional(),
  mealTime: z.nativeEnum(MealTime).optional(),
  search: z.string().trim().max(100).optional(),
  /** 1-indexed current page (defaults to 1) */
  page: z.coerce.number().int().min(1).default(1),
  /** Number of dishes per page (defaults to 12, max 100) */
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
})

export type DishFilterInput = z.infer<typeof DishFilterSchema>
