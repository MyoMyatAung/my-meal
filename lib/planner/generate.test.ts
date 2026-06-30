import { describe, it, expect, afterEach } from "vitest"
import { generatePlan, PreFlightGateError, LUNCH_THREE_DISH_PROBABILITY } from "./generate"
import { checkPreFlightGate } from "./gate"
import { hasFlavorCollision, wouldRepeat, pickNonRepeatDish } from "./rules"
import {
  tooSmallLibrary,
  noSpecialLibrary,
  singleFlavorLibrary,
  barelySufficientLibrary,
  normalLibrary,
} from "./fixtures"
import type { PlannerDish, GenerationInput } from "./types"

function createSeededRandom(values: number[]): () => number {
  let i = 0
  return () => {
    const v = values[i % values.length]
    i++
    return v
  }
}

function makeTestInput(
  dishes: PlannerDish[],
  durationDays: number,
  random?: () => number,
  startDate?: Date
): GenerationInput {
  return {
    dishes,
    startDate: startDate ?? new Date("2026-01-05T00:00:00.000Z"),
    durationDays,
    random,
  }
}

function getLunchEntries(result: ReturnType<typeof generatePlan>) {
  return result.entries.filter((e) => e.mealTime === "Lunch")
}

function getBreakfastEntries(result: ReturnType<typeof generatePlan>) {
  return result.entries.filter((e) => e.mealTime === "Breakfast")
}

function getSpecialDayEntries(result: ReturnType<typeof generatePlan>) {
  return result.entries.filter((e) => e.mealTime === "Lunch" && e.isSpecialDay)
}

describe("checkPreFlightGate", () => {
  it("blocks when library has 0 Breakfast dishes", () => {
    const result = checkPreFlightGate([
      {
        id: "l1",
        name: "Lunch 1",
        mealTime: "Lunch",
        isSpecial: false,
        flavors: [],
        ingredientNames: [],
      },
    ])
    expect(result.blocked).toBe(true)
    expect(result.errors[0]).toContain("Breakfast")
  })

  it("blocks when library has < 2 Lunch dishes", () => {
    const result = checkPreFlightGate([
      {
        id: "b1",
        name: "Breakfast 1",
        mealTime: "Breakfast",
        isSpecial: false,
        flavors: [],
        ingredientNames: [],
      },
      {
        id: "l1",
        name: "Lunch 1",
        mealTime: "Lunch",
        isSpecial: false,
        flavors: [],
        ingredientNames: [],
      },
    ])
    expect(result.blocked).toBe(true)
    expect(result.errors.some((e) => e.includes("Lunch"))).toBe(true)
  })

  it("passes with valid library", () => {
    const result = checkPreFlightGate(normalLibrary)
    expect(result.blocked).toBe(false)
    expect(result.errors).toHaveLength(0)
  })

  it("throws PreFlightGateError with the gate's error messages when blocked", () => {
    expect(() =>
      generatePlan(makeTestInput(tooSmallLibrary, 14))
    ).toThrow(PreFlightGateError)

    try {
      generatePlan(makeTestInput(tooSmallLibrary, 14))
    } catch (e) {
      expect(e).toBeInstanceOf(PreFlightGateError)
      const err = e as PreFlightGateError
      expect(err.errors.length).toBeGreaterThan(0)
      expect(err.errors.some((m) => m.includes("Breakfast"))).toBe(true)
      expect(err.errors.some((m) => m.includes("Lunch"))).toBe(true)
    }
  })
})

describe("PreFlightGateError", () => {
  it("has the correct name property", () => {
    const err = new PreFlightGateError(["test error"])
    expect(err.name).toBe("PreFlightGateError")
    expect(err.message).toBe("test error")
  })

  it("joins multiple errors with semicolons", () => {
    const err = new PreFlightGateError(["error 1", "error 2"])
    expect(err.message).toBe("error 1; error 2")
  })
})

describe("rules", () => {
  it("hasFlavorCollision detects overlapping flavors", () => {
    const dishes: PlannerDish[] = [
      { id: "a", name: "A", mealTime: "Lunch", isSpecial: false, flavors: ["salty", "sweet"], ingredientNames: [] },
      { id: "b", name: "B", mealTime: "Lunch", isSpecial: false, flavors: ["salty", "spicy"], ingredientNames: [] },
    ]
    expect(hasFlavorCollision(dishes)).toBe(true)
  })

  it("hasFlavorCollision returns false for distinct flavors", () => {
    const dishes: PlannerDish[] = [
      { id: "a", name: "A", mealTime: "Lunch", isSpecial: false, flavors: ["salty"], ingredientNames: [] },
      { id: "b", name: "B", mealTime: "Lunch", isSpecial: false, flavors: ["sweet"], ingredientNames: [] },
    ]
    expect(hasFlavorCollision(dishes)).toBe(false)
  })

  it("wouldRepeat detects duplicate IDs", () => {
    const ids = new Set(["a", "b", "c"])
    expect(wouldRepeat(ids, "b")).toBe(true)
    expect(wouldRepeat(ids, "d")).toBe(false)
  })

  it("pickNonRepeatDish returns first non-repeating dish", () => {
    const candidates: PlannerDish[] = [
      { id: "a", name: "A", mealTime: "Lunch", isSpecial: false, flavors: [], ingredientNames: [] },
      { id: "b", name: "B", mealTime: "Lunch", isSpecial: false, flavors: [], ingredientNames: [] },
    ]
    const ids = new Set(["a"])
    const picked = pickNonRepeatDish(ids, candidates)
    expect(picked?.id).toBe("b")
  })

  it("pickNonRepeatDish returns null when all candidates are repeats", () => {
    const candidates: PlannerDish[] = [
      { id: "a", name: "A", mealTime: "Lunch", isSpecial: false, flavors: [], ingredientNames: [] },
    ]
    const ids = new Set(["a"])
    expect(pickNonRepeatDish(ids, candidates)).toBeNull()
  })
})

describe("Special Day placement", () => {
  it("places exactly one special day per 14-day window on a weekend", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 14, random))
    const specials = getSpecialDayEntries(result)
    expect(specials).toHaveLength(1)
    const dayOfWeek = specials[0].date.getUTCDay()
    expect(dayOfWeek === 0 || dayOfWeek === 6).toBe(true)
  })

  it("places 2 special days across a 28-day plan, one per window", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 28, random))
    const specials = getSpecialDayEntries(result)
    expect(specials).toHaveLength(2)
  })

  it("emits NO_SPECIAL_DISH warning exactly once when no special dish exists, regardless of duration", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(noSpecialLibrary, 28, random))
    const noSpecialWarnings = result.warnings.filter((w) => w.code === "NO_SPECIAL_DISH")
    expect(noSpecialWarnings).toHaveLength(1)
  })

  it("assigns single special dish to special day's lunch", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 14, random))
    const specials = getSpecialDayEntries(result)
    expect(specials.length).toBeGreaterThan(0)
    for (const s of specials) {
      expect(s.dishes).toHaveLength(1)
      const specialDish = normalLibrary.find((d) => d.isSpecial)
      expect(s.dishes[0].dishId).toBe(specialDish!.id)
    }
  })
})

describe("Breakfast", () => {
  it("assigns 1 breakfast dish per day", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 7, random))
    const breakfasts = getBreakfastEntries(result)
    expect(breakfasts).toHaveLength(7)
    for (const b of breakfasts) {
      expect(b.dishes).toHaveLength(1)
    }
  })

  it("does not repeat breakfast dishes within the period", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 7, random))
    const breakfasts = getBreakfastEntries(result)
    const ids = breakfasts.map((b) => b.dishes[0].dishId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("emits INSUFFICIENT_BREAKFAST_VARIETY when repeat is forced", () => {
    const smallBreakfastLib: PlannerDish[] = [
      { id: "b1", name: "Only Breakfast", mealTime: "Breakfast", isSpecial: false, flavors: ["sweet"], ingredientNames: ["oats"] },
      { id: "l1", name: "Lunch 1", mealTime: "Lunch", isSpecial: false, flavors: ["a"], ingredientNames: ["x"] },
      { id: "l2", name: "Lunch 2", mealTime: "Lunch", isSpecial: false, flavors: ["b"], ingredientNames: ["y"] },
    ]
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(smallBreakfastLib, 7, random))
    const warnings = result.warnings.filter((w) => w.code === "INSUFFICIENT_BREAKFAST_VARIETY")
    expect(warnings.length).toBeGreaterThan(0)
  })
})

describe("Lunch", () => {
  it("assigns 2 lunch dishes per non-special day when random() is above the 3-dish threshold", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(normalLibrary, 7, random))
    const nonSpecialLunches = getLunchEntries(result).filter((e) => !e.isSpecialDay)
    for (const l of nonSpecialLunches) {
      expect(l.dishes.length).toBeGreaterThanOrEqual(2)
    }
  })

  it("assigns 3 lunch dishes when random() is below the 3-dish threshold and >=3 valid candidates exist", () => {
    const random = createSeededRandom(Array(500).fill(0.05))
    const result = generatePlan(makeTestInput(normalLibrary, 1, random))
    const lunches = getLunchEntries(result)
    expect(lunches.length).toBe(1)
    expect(lunches[0].dishes.length).toBe(3)
  })

  it("assigns 1 dish on special day", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 14, random))
    const specials = getSpecialDayEntries(result)
    expect(specials.length).toBeGreaterThan(0)
    for (const s of specials) {
      expect(s.dishes).toHaveLength(1)
    }
  })

  it("does not repeat lunch dishes within the period", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(barelySufficientLibrary, 14, random))
    const lunches = getLunchEntries(result)
    const allIds = lunches.flatMap((l) => l.dishes.map((d) => d.dishId))
    const uniqueIds = new Set(allIds)
    expect(uniqueIds.size).toBe(allIds.length)
  })

  it("emits REPEAT_FORCED when lunch variety is insufficient", () => {
    const tinyLib: PlannerDish[] = [
      { id: "b1", name: "Breakfast 1", mealTime: "Breakfast", isSpecial: false, flavors: ["sweet"], ingredientNames: ["oats"] },
      { id: "b2", name: "Breakfast 2", mealTime: "Breakfast", isSpecial: false, flavors: ["savory"], ingredientNames: ["eggs"] },
      { id: "l1", name: "Lunch 1", mealTime: "Lunch", isSpecial: false, flavors: ["a"], ingredientNames: ["x"] },
      { id: "l2", name: "Lunch 2", mealTime: "Lunch", isSpecial: false, flavors: ["b"], ingredientNames: ["y"] },
    ]
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(tinyLib, 7, random))
    const warnings = result.warnings.filter((w) => w.code === "REPEAT_FORCED")
    expect(warnings.length).toBeGreaterThan(0)
  })

  it("enforces flavor uniqueness within a lunch slot", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(normalLibrary, 7, random))
    const lunches = getLunchEntries(result)
    for (const l of lunches) {
      if (l.dishes.length >= 2) {
        const allFlavors = l.dishes.flatMap((d) => {
          const dish = normalLibrary.find((nd) => nd.id === d.dishId)
          return dish?.flavors ?? []
        })
        expect(new Set(allFlavors).size).toBe(allFlavors.length)
      }
    }
  })

  it("emits FLAVOR_COLLISION_RELAXED when flavors collide", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(singleFlavorLibrary, 7, random))
    const warnings = result.warnings.filter((w) => w.code === "FLAVOR_COLLISION_RELAXED")
    expect(warnings.length).toBeGreaterThan(0)
  })
})

describe("Shopping list", () => {
  it("deduplicates ingredients across dishes", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 7, random))
    const names = result.shoppingItems.map((i) => i.ingredientName)
    expect(new Set(names).size).toBe(names.length)
  })

  it("snapshots dish name for each ingredient", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 7, random))
    for (const item of result.shoppingItems) {
      expect(item.dishName).toBeTruthy()
      expect(typeof item.dishName).toBe("string")
    }
  })
})

describe("timezone safety", () => {
  const originalTZ = process.env.TZ

  afterEach(() => {
    process.env.TZ = originalTZ
  })

  it("produces identical entry dates under UTC and a negative-offset timezone", () => {
    const input = {
      dishes: normalLibrary,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      durationDays: 14,
      random: () => 0.5,
    }

    process.env.TZ = "UTC"
    const outputUTC = generatePlan(input)

    process.env.TZ = "America/New_York"
    const outputNY = generatePlan(input)

    expect(outputNY.entries.map((e) => e.date.toISOString())).toEqual(
      outputUTC.entries.map((e) => e.date.toISOString())
    )
    expect(outputNY.warnings).toEqual(outputUTC.warnings)
  })

  it("places the special day on a UTC Saturday or Sunday even under a negative-offset timezone", () => {
    process.env.TZ = "America/New_York"

    const output = generatePlan({
      dishes: normalLibrary,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      durationDays: 14,
      random: () => 0,
    })

    const specialEntry = output.entries.find(
      (e) => e.mealTime === "Lunch" && e.isSpecialDay
    )

    expect(specialEntry).toBeDefined()
    const weekday = specialEntry!.date.getUTCDay()
    expect([0, 6]).toContain(weekday)
  })
})

describe("Edge cases", () => {
  it("handles 1-day duration", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 1, random))
    expect(result.entries.length).toBe(2)
    expect(getBreakfastEntries(result)).toHaveLength(1)
    expect(getLunchEntries(result)).toHaveLength(1)
  })

  it("handles 7-day duration", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 7, random))
    expect(getBreakfastEntries(result)).toHaveLength(7)
    expect(getLunchEntries(result)).toHaveLength(7)
  })

  it("handles 14-day duration", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 14, random))
    expect(getBreakfastEntries(result)).toHaveLength(14)
    expect(getLunchEntries(result)).toHaveLength(14)
    expect(getSpecialDayEntries(result)).toHaveLength(1)
  })

  it("handles 28-day duration (two 2-week cycles)", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 28, random))
    expect(getBreakfastEntries(result)).toHaveLength(28)
    expect(getLunchEntries(result)).toHaveLength(28)
    expect(getSpecialDayEntries(result)).toHaveLength(2)
  })

  it("handles 20-day duration (one full window + a 6-day trailing window)", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 20, random))
    expect(getBreakfastEntries(result)).toHaveLength(20)
    expect(getLunchEntries(result)).toHaveLength(20)
    expect(getSpecialDayEntries(result)).toHaveLength(2)
  })
})
