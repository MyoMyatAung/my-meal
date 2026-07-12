import { describe, it, expect } from "vitest"
import { hasFlavorCollision } from "./rules"
import type { PlannerDish } from "./types"

describe("hasFlavorCollision", () => {
  it("returns false for an empty dish list", () => {
    expect(hasFlavorCollision([])).toBe(false)
  })

  it("returns false for a single dish", () => {
    expect(hasFlavorCollision([{ flavors: ["salty"] }])).toBe(false)
  })

  it("returns false when all dishes have distinct flavors", () => {
    expect(
      hasFlavorCollision([{ flavors: ["salty"] }, { flavors: ["sweet"] }])
    ).toBe(false)
  })

  it("returns true when two dishes share a flavor", () => {
    expect(
      hasFlavorCollision([{ flavors: ["salty"] }, { flavors: ["salty"] }])
    ).toBe(true)
  })

  it("returns true when a shared flavor is buried among other distinct flavors", () => {
    expect(
      hasFlavorCollision([
        { flavors: ["spicy", "salty"] },
        { flavors: ["salty", "sweet"] },
      ])
    ).toBe(true)
  })

  it("returns true when a single dish repeats a flavor within itself", () => {
    expect(hasFlavorCollision([{ flavors: ["salty", "salty"] }])).toBe(true)
  })

  it("returns false when every dish has an empty flavors array", () => {
    expect(hasFlavorCollision([{ flavors: [] }, { flavors: [] }])).toBe(false)
  })

  it("accepts the widened { flavors: string[] }[] shape without extra dish fields", () => {
    // This is the whole point of the Phase 6 signature widen: callers no
    // longer need to fabricate id/name/mealTime/isSpecial/ingredientNames
    // just to check for a flavor collision.
    const editTimeDishes: { flavors: string[] }[] = [
      { flavors: ["umami"] },
      { flavors: ["umami"] },
    ]
    expect(hasFlavorCollision(editTimeDishes)).toBe(true)
  })

  it("still accepts full PlannerDish[] objects (backward compatible with generation callers)", () => {
    const plannerDishes: PlannerDish[] = [
      {
        id: "a",
        name: "Dish A",
        mealTime: "Lunch",
        isSpecial: false,
        flavors: ["savory"],
        ingredientNames: ["chicken"],
      },
      {
        id: "b",
        name: "Dish B",
        mealTime: "Lunch",
        isSpecial: false,
        flavors: ["savory"],
        ingredientNames: ["beef"],
      },
    ]
    expect(hasFlavorCollision(plannerDishes)).toBe(true)
  })

  it("detects a collision across three or more dishes", () => {
    expect(
      hasFlavorCollision([
        { flavors: ["a"] },
        { flavors: ["b"] },
        { flavors: ["c"] },
        { flavors: ["a"] },
      ])
    ).toBe(true)
  })
})