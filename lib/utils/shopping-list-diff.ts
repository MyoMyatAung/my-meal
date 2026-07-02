export interface ExistingShoppingItem {
  id: string
  ingredientId: string
}

export interface ShoppingListDiff {
  toCreateIngredientIds: string[]
  toDeleteItemIds: string[]
}

export function diffShoppingList(
  requiredIngredientIds: Set<string>,
  existingItems: ExistingShoppingItem[]
): ShoppingListDiff {
  const existingIngredientIds = new Set(existingItems.map((item) => item.ingredientId))

  const toCreateIngredientIds = [...requiredIngredientIds].filter(
    (ingredientId) => !existingIngredientIds.has(ingredientId)
  )

  const toDeleteItemIds = existingItems
    .filter((item) => !requiredIngredientIds.has(item.ingredientId))
    .map((item) => item.id)

  return { toCreateIngredientIds, toDeleteItemIds }
}
