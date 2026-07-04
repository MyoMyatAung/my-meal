import { describe, it, expect } from "vitest"
import { computeEntryWarnings, type WarningEntry } from "./edit-warnings"

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe("computeEntryWarnings", () => {
  it("returns an empty map when there are no violations", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "lunch-1",
        date: d("2026-01-05"),
        mealTime: "Lunch",
        dishes: [
          { dishId: "a", dishName: "A", flavors: ["salty"] },
          { dishId: "b", dishName: "B", flavors: ["sweet"] },
        ],
      },
      {
        entryId: "breakfast-1",
        date: d("2026-01-05"),
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
        date: d("2026-01-05"),
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

  it("flags repeats within the same 7-day block for all affected entries", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "lunch-1",
        date: d("2026-01-05"),
        mealTime: "Lunch",
        dishes: [{ dishId: "repeat", dishName: "Repeat Dish", flavors: ["a"] }],
      },
      {
        entryId: "lunch-2",
        date: d("2026-01-07"),
        mealTime: "Lunch",
        dishes: [{ dishId: "repeat", dishName: "Repeat Dish", flavors: ["b"] }],
      },
      {
        entryId: "lunch-3",
        date: d("2026-01-06"),
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

  it("does not flag the same dish recurring in a later 7-day block", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "breakfast-week1",
        date: d("2026-01-05"),
        mealTime: "Breakfast",
        dishes: [{ dishId: "nn", dishName: "နန်းသေးသုပ်", flavors: ["a"] }],
      },
      {
        entryId: "breakfast-week2",
        date: d("2026-01-13"),
        mealTime: "Breakfast",
        dishes: [{ dishId: "nn", dishName: "နန်းသေးသုပ်", flavors: ["a"] }],
      },
    ]

    const result = computeEntryWarnings(entries)
    expect(result.size).toBe(0)
  })

  it("does not add flavor collision warnings for breakfast entries", () => {
    const entries: WarningEntry[] = [
      {
        entryId: "breakfast-1",
        date: d("2026-01-05"),
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
})
