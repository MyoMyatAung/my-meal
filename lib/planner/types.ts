// Redeclared locally rather than imported from @prisma/client — lib/planner
// has zero framework/ORM imports (architecture.md invariant 1).
export type Category = "MAIN" | "SIDE" | "SOUP" | "SNACK" | "ACCOMPANIMENTS" | "OTHER"

export interface PlannerDish {
  id: string
  name: string
  category: Category
  mealTime: "Breakfast" | "Lunch"
  isSpecial: boolean
  flavors: string[]
  ingredientNames: string[]
  pairedDishIds: string[]
}

export interface GenerationInput {
  dishes: PlannerDish[]
  startDate: Date
  durationDays: number
  random?: () => number
}

export type WarningCode =
  | "INSUFFICIENT_BREAKFAST_VARIETY"
  | "FLAVOR_COLLISION_RELAXED"
  | "NO_SPECIAL_DISH"
  | "REPEAT_FORCED"
  | "NO_PAIRED_DISH_FALLBACK"

export interface PlannerWarning {
  code: WarningCode
  message: string
}

export interface PlannerEntryDish {
  dishId: string
  dishName: string
  sortOrder: number
}

export interface PlannerEntry {
  date: Date
  mealTime: "Breakfast" | "Lunch"
  dishes: PlannerEntryDish[]
  isSpecialDay: boolean
}

export interface ShoppingItem {
  ingredientName: string
  dishName: string
}

export interface GenerationOutput {
  entries: PlannerEntry[]
  warnings: PlannerWarning[]
  shoppingItems: ShoppingItem[]
}
