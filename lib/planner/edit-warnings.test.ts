import { describe, it, expect } from "vitest"
import { computeEntryWarnings, type WarningEntry } from "./edit-warnings"

describe("computeEntryWarnings", () => {
  it("returns an empty map when there are no violations", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "lunch-1",
        mealTime: "Lunch",
        dishes: [
          { dishId: "a", dishName: "A", flavors: ["salty"] },
          { dishId: "b", dishName: "B", flavors: ["sweet"] },
        ],
      },
      {
        entryId: "breakfast-1",
        mealTime: "Breakfast",
        dishes: [{ dishId: "c", dishName: "C", flavors: ["savory"] }],
      },
    ]

    const result = computeEntryWarnings(entries)
    expect(result.size).toBe(0)
  })

  it("flags lunch flavor collisions and includes the first duplicate flavor", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "lunch-1",
        mealTime: "Lunch",
        dishes: [
          { dishId: "a", dishName: "A", flavors: ["spicy", "salty"] },
          { dishId: "b", dishName: "B", flavors: ["salty", "sweet"] },
        ],
      },
    ]

    const result = computeEntryWarnings(entries)
    expect(result.get("lunch-1")).toContain(
      "Two lunch dishes share a flavor (salty) - saved anyway"
    )
  })

  it("flags repeats for all affected entries of the same meal time", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "lunch-1",
        mealTime: "Lunch",
        dishes: [{ dishId: "repeat", dishName: "Repeat Dish", flavors: ["a"] }],
      },
      {
        entryId: "lunch-2",
        mealTime: "Lunch",
        dishes: [{ dishId: "repeat", dishName: "Repeat Dish", flavors: ["b"] }],
      },
      {
        entryId: "lunch-3",
        mealTime: "Lunch",
        dishes: [{ dishId: "other", dishName: "Other", flavors: ["c"] }],
      },
    ]

    const result = computeEntryWarnings(entries)
    expect(result.get("lunch-1")).toContain(
      '"Repeat Dish" repeats elsewhere in this plan - saved anyway'
    )
    expect(result.get("lunch-2")).toContain(
      '"Repeat Dish" repeats elsewhere in this plan - saved anyway'
    )
    expect(result.get("lunch-3")).toBeUndefined()
  })

  it("does not add flavor collision warnings for breakfast entries", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "breakfast-1",
        mealTime: "Breakfast",
        dishes: [
          { dishId: "a", dishName: "A", flavors: ["sweet"] },
          { dishId: "b", dishName: "B", flavors: ["sweet"] },
        ],
      },
    ]

    const result = computeEntryWarnings(entries)
    expect(result.size).toBe(0)
  })

  it("still applies the repeat check to breakfast entries", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "breakfast-1",
        mealTime: "Breakfast",
        dishes: [{ dishId: "repeat", dishName: "Toast", flavors: ["sweet"] }],
      },
      {
        entryId: "breakfast-2",
        mealTime: "Breakfast",
        dishes: [{ dishId: "repeat", dishName: "Toast", flavors: ["sweet"] }],
      },
    ]

    const result = computeEntryWarnings(entries)
    expect(result.get("breakfast-1")).toContain(
      '"Toast" repeats elsewhere in this plan - saved anyway'
    )
    expect(result.get("breakfast-2")).toContain(
      '"Toast" repeats elsewhere in this plan - saved anyway'
    )
  })

  it("does not flag a repeat across different meal times", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "breakfast-1",
        mealTime: "Breakfast",
        dishes: [{ dishId: "shared", dishName: "Shared Dish", flavors: ["a"] }],
      },
      {
        entryId: "lunch-1",
        mealTime: "Lunch",
        dishes: [{ dishId: "shared", dishName: "Shared Dish", flavors: ["b"] }],
      },
    ]

    const result = computeEntryWarnings(entries)
    expect(result.size).toBe(0)
  })

  it("does not flag a repeat when the same dish appears twice within one entry", () => {
    // Duplicate-within-one-entry is treated as a hard-blocked UI case
    // elsewhere, not a "repeats elsewhere" warning — a single entry
    // referencing the same dish id twice should not, by itself, produce
    // a repeat warning about a *different* entry.
    const entries: WarningEntry[] = [
      {
        entryId: "lunch-1",
        mealTime: "Lunch",
        dishes: [
          { dishId: "dup", dishName: "Dup Dish", flavors: ["a"] },
          { dishId: "dup", dishName: "Dup Dish", flavors: ["b"] },
        ],
      },
    ]

    const result = computeEntryWarnings(entries)
    expect(result.get("lunch-1")).toBeUndefined()
  })

  it("returns an empty map for an empty entries array", () => {
    const result = computeEntryWarnings([])
    expect(result.size).toBe(0)
  })

  it("handles an entry with no dishes without throwing", () => {
    const entries: WarningEntry[] = [
      { entryId: "lunch-empty", mealTime: "Lunch", dishes: [] },
    ]

    expect(() => computeEntryWarnings(entries)).not.toThrow()
    expect(computeEntryWarnings(entries).size).toBe(0)
  })

  it("emits both a flavor-collision and a repeat warning on the same entry when both apply", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "lunch-1",
        mealTime: "Lunch",
        dishes: [
          { dishId: "repeat", dishName: "Repeat Dish", flavors: ["salty"] },
          { dishId: "other", dishName: "Other", flavors: ["salty"] },
        ],
      },
      {
        entryId: "lunch-2",
        mealTime: "Lunch",
        dishes: [{ dishId: "repeat", dishName: "Repeat Dish", flavors: ["sweet"] }],
      },
    ]

    const result = computeEntryWarnings(entries)
    const lunch1Warnings = result.get("lunch-1")!
    expect(lunch1Warnings).toContain(
      "Two lunch dishes share a flavor (salty) - saved anyway"
    )
    expect(lunch1Warnings).toContain(
      '"Repeat Dish" repeats elsewhere in this plan - saved anyway'
    )
    expect(lunch1Warnings).toHaveLength(2)
  })

  it("reports the first duplicate flavor encountered in dish order, not any later duplicate", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "lunch-1",
        mealTime: "Lunch",
        dishes: [
          { dishId: "a", dishName: "A", flavors: ["sweet"] },
          { dishId: "b", dishName: "B", flavors: ["sweet", "salty"] },
          { dishId: "c", dishName: "C", flavors: ["salty"] },
        ],
      },
    ]

    const result = computeEntryWarnings(entries)
    expect(result.get("lunch-1")).toContain(
      "Two lunch dishes share a flavor (sweet) - saved anyway"
    )
  })
})
