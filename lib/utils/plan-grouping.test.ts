import { describe, it, expect } from "vitest"
import { buildEntriesByDate, buildWeeksFromDateKeys } from "./plan-grouping"

function makeEntry(overrides: {
  id: string
  date: string
  mealTime: "Breakfast" | "Lunch"
  entryWarnings?: string[]
  dishes: {
    id: string
    sortOrder: number
    dish: { id: string; name: string; isSpecial: boolean }
  }[]
}) {
  return {
    entryWarnings: [],
    ...overrides,
  }
}

describe("buildEntriesByDate", () => {
  it("returns an empty map for no entries", () => {
    const result = buildEntriesByDate([])
    expect(result.size).toBe(0)
  })

  it("groups a single breakfast entry under its date key", () => {
    const entries = [
      makeEntry({
        id: "e1",
        date: "2026-07-01T00:00:00.000Z",
        mealTime: "Breakfast",
        dishes: [
          { id: "ed1", sortOrder: 0, dish: { id: "d1", name: "Oatmeal", isSpecial: false } },
        ],
      }),
    ]

    const result = buildEntriesByDate(entries)
    expect(result.size).toBe(1)
    const day = result.get("2026-07-01")!
    expect(day.breakfast).toEqual([
      { dishId: "d1", entryDishId: "ed1", dishName: "Oatmeal" },
    ])
    expect(day.lunch).toEqual([])
    expect(day.isSpecialDay).toBe(false)
    expect(day.warnings).toEqual([])
  })

  it("marks a day special when any lunch dish is special", () => {
    const entries = [
      makeEntry({
        id: "e1",
        date: "2026-07-01",
        mealTime: "Lunch",
        dishes: [
          { id: "ed1", sortOrder: 0, dish: { id: "d1", name: "Regular", isSpecial: false } },
          { id: "ed2", sortOrder: 1, dish: { id: "d2", name: "Special", isSpecial: true } },
        ],
      }),
    ]

    const result = buildEntriesByDate(entries)
    const day = result.get("2026-07-01")!
    expect(day.isSpecialDay).toBe(true)
    expect(day.lunch).toEqual([
      { dishId: "d1", entryDishId: "ed1", dishName: "Regular", sortOrder: 0, isSpecial: false },
      { dishId: "d2", entryDishId: "ed2", dishName: "Special", sortOrder: 1, isSpecial: true },
    ])
  })

  it("does not mark a day special when no lunch dish is special", () => {
    const entries = [
      makeEntry({
        id: "e1",
        date: "2026-07-01",
        mealTime: "Lunch",
        dishes: [
          { id: "ed1", sortOrder: 0, dish: { id: "d1", name: "Regular", isSpecial: false } },
        ],
      }),
    ]

    const result = buildEntriesByDate(entries)
    expect(result.get("2026-07-01")!.isSpecialDay).toBe(false)
  })

  it("merges breakfast and lunch entries that fall on the same date", () => {
    const entries = [
      makeEntry({
        id: "e1",
        date: "2026-07-01",
        mealTime: "Breakfast",
        dishes: [
          { id: "ed1", sortOrder: 0, dish: { id: "d1", name: "Eggs", isSpecial: false } },
        ],
      }),
      makeEntry({
        id: "e2",
        date: "2026-07-01",
        mealTime: "Lunch",
        dishes: [
          { id: "ed2", sortOrder: 0, dish: { id: "d2", name: "Salad", isSpecial: false } },
        ],
      }),
    ]

    const result = buildEntriesByDate(entries)
    expect(result.size).toBe(1)
    const day = result.get("2026-07-01")!
    expect(day.breakfast).toHaveLength(1)
    expect(day.lunch).toHaveLength(1)
  })

  it("keeps entries on different dates in separate map keys", () => {
    const entries = [
      makeEntry({
        id: "e1",
        date: "2026-07-01",
        mealTime: "Breakfast",
        dishes: [{ id: "ed1", sortOrder: 0, dish: { id: "d1", name: "Eggs", isSpecial: false } }],
      }),
      makeEntry({
        id: "e2",
        date: "2026-07-02",
        mealTime: "Breakfast",
        dishes: [{ id: "ed2", sortOrder: 0, dish: { id: "d2", name: "Toast", isSpecial: false } }],
      }),
    ]

    const result = buildEntriesByDate(entries)
    expect(result.size).toBe(2)
    expect(result.has("2026-07-01")).toBe(true)
    expect(result.has("2026-07-02")).toBe(true)
  })

  it("normalizes a full ISO datetime string to its calendar date key", () => {
    const entries = [
      makeEntry({
        id: "e1",
        date: "2026-07-01T15:30:00.000Z",
        mealTime: "Breakfast",
        dishes: [{ id: "ed1", sortOrder: 0, dish: { id: "d1", name: "Eggs", isSpecial: false } }],
      }),
    ]

    const result = buildEntriesByDate(entries)
    expect(result.has("2026-07-01")).toBe(true)
  })

  it("collects entryWarnings onto the corresponding day", () => {
    const entries = [
      makeEntry({
        id: "e1",
        date: "2026-07-01",
        mealTime: "Lunch",
        entryWarnings: ["flavor collision"],
        dishes: [{ id: "ed1", sortOrder: 0, dish: { id: "d1", name: "Soup", isSpecial: false } }],
      }),
    ]

    const result = buildEntriesByDate(entries)
    expect(result.get("2026-07-01")!.warnings).toEqual(["flavor collision"])
  })

  it("accumulates warnings from multiple entries sharing the same date", () => {
    const entries = [
      makeEntry({
        id: "e1",
        date: "2026-07-01",
        mealTime: "Breakfast",
        entryWarnings: ["breakfast repeat"],
        dishes: [{ id: "ed1", sortOrder: 0, dish: { id: "d1", name: "Eggs", isSpecial: false } }],
      }),
      makeEntry({
        id: "e2",
        date: "2026-07-01",
        mealTime: "Lunch",
        entryWarnings: ["lunch collision"],
        dishes: [{ id: "ed2", sortOrder: 0, dish: { id: "d2", name: "Soup", isSpecial: false } }],
      }),
    ]

    const result = buildEntriesByDate(entries)
    expect(result.get("2026-07-01")!.warnings).toEqual([
      "breakfast repeat",
      "lunch collision",
    ])
  })

  it("does not push anything to warnings when entryWarnings is empty", () => {
    const entries = [
      makeEntry({
        id: "e1",
        date: "2026-07-01",
        mealTime: "Lunch",
        entryWarnings: [],
        dishes: [{ id: "ed1", sortOrder: 0, dish: { id: "d1", name: "Soup", isSpecial: false } }],
      }),
    ]

    const result = buildEntriesByDate(entries)
    expect(result.get("2026-07-01")!.warnings).toEqual([])
  })

  it("handles an entry with no dishes without throwing", () => {
    const entries = [
      makeEntry({
        id: "e1",
        date: "2026-07-01",
        mealTime: "Lunch",
        dishes: [],
      }),
    ]

    const result = buildEntriesByDate(entries)
    const day = result.get("2026-07-01")!
    expect(day.lunch).toEqual([])
    expect(day.isSpecialDay).toBe(false)
  })

  it("preserves sortOrder for each lunch dish", () => {
    const entries = [
      makeEntry({
        id: "e1",
        date: "2026-07-01",
        mealTime: "Lunch",
        dishes: [
          { id: "ed1", sortOrder: 1, dish: { id: "d1", name: "Second", isSpecial: false } },
          { id: "ed2", sortOrder: 0, dish: { id: "d2", name: "First", isSpecial: false } },
        ],
      }),
    ]

    const result = buildEntriesByDate(entries)
    const day = result.get("2026-07-01")!
    expect(day.lunch[0]).toMatchObject({ dishName: "Second", sortOrder: 1 })
    expect(day.lunch[1]).toMatchObject({ dishName: "First", sortOrder: 0 })
  })
})

describe("buildWeeksFromDateKeys", () => {
  it("returns an empty array for no date keys", () => {
    expect(buildWeeksFromDateKeys([])).toEqual([])
  })

  it("puts fewer than 7 dates into a single week", () => {
    const result = buildWeeksFromDateKeys(["2026-07-02", "2026-07-01", "2026-07-03"])
    expect(result).toEqual([
      { label: "Week 1", dates: ["2026-07-01", "2026-07-02", "2026-07-03"] },
    ])
  })

  it("sorts date keys before chunking, regardless of input order", () => {
    const result = buildWeeksFromDateKeys(["2026-07-05", "2026-07-01"])
    expect(result[0].dates).toEqual(["2026-07-01", "2026-07-05"])
  })

  it("puts exactly 7 dates into a single week", () => {
    const dates = [
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
    ]
    const result = buildWeeksFromDateKeys(dates)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ label: "Week 1", dates })
  })

  it("splits 8 dates into a full week and a second week with the remainder", () => {
    const dates = [
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
    ]
    const result = buildWeeksFromDateKeys(dates)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ label: "Week 1", dates: dates.slice(0, 7) })
    expect(result[1]).toEqual({ label: "Week 2", dates: ["2026-07-08"] })
  })

  it("labels weeks sequentially for exactly 14 dates", () => {
    const dates = Array.from({ length: 14 }, (_, i) =>
      `2026-07-${String(i + 1).padStart(2, "0")}`
    )
    const result = buildWeeksFromDateKeys(dates)
    expect(result.map((w) => w.label)).toEqual(["Week 1", "Week 2"])
    expect(result[0].dates).toHaveLength(7)
    expect(result[1].dates).toHaveLength(7)
  })

  it("does not mutate the input array", () => {
    const dates = ["2026-07-03", "2026-07-01"]
    const original = [...dates]
    buildWeeksFromDateKeys(dates)
    expect(dates).toEqual(original)
  })
})