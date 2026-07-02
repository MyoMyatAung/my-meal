import { describe, it, expect } from "vitest"
import { diffShoppingList } from "./shopping-list-diff"

describe("diffShoppingList", () => {
  it("creates items for newly required ingredients", () => {
    const required = new Set(["ing-1"])
    const existing: { id: string; ingredientId: string }[] = []

    const result = diffShoppingList(required, existing)
    expect(result.toCreateIngredientIds).toEqual(["ing-1"])
    expect(result.toDeleteItemIds).toEqual([])
  })

  it("deletes items for ingredients no longer required", () => {
    const required = new Set<string>()
    const existing = [{ id: "item-1", ingredientId: "ing-1" }]

    const result = diffShoppingList(required, existing)
    expect(result.toCreateIngredientIds).toEqual([])
    expect(result.toDeleteItemIds).toEqual(["item-1"])
  })

  it("keeps shared ingredients when still required", () => {
    const required = new Set(["ing-shared"])
    const existing = [{ id: "item-shared", ingredientId: "ing-shared" }]

    const result = diffShoppingList(required, existing)
    expect(result.toCreateIngredientIds).toEqual([])
    expect(result.toDeleteItemIds).toEqual([])
  })

  it("returns no changes when sets are equivalent", () => {
    const required = new Set(["ing-1", "ing-2"])
    const existing = [
      { id: "item-1", ingredientId: "ing-1" },
      { id: "item-2", ingredientId: "ing-2" },
    ]

    const result = diffShoppingList(required, existing)
    expect(result.toCreateIngredientIds).toEqual([])
    expect(result.toDeleteItemIds).toEqual([])
  })
})
