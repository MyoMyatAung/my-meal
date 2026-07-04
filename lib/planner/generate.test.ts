import { describe, it, expect, afterEach } from "vitest"
import { generatePlan, PreFlightGateError, MAIN_SIDE_SAME_FLAVOR_PROBABILITY } from "./generate"
import { checkPreFlightGate } from "./gate"
import {
  hasFlavorCollision,
  sharesFlavor,
  wouldRepeat,
  pickNonRepeatDish,
  pickPairedSideOrSoup,
  pickCompensatoryDish,
} from "./rules"
import {
  tooSmallLibrary,
  noMainLibrary,
  noSideOrSoupLibrary,
  noSpecialLibrary,
  singleFlavorLibrary,
  barelySufficientLibrary,
  unpairedMainLibrary,
  pairedMixedFlavorLibrary,
  triplePairedLibrary,
  compensatoryFallbackLibrary,
  weeklyRepeatLibrary,
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

/** Deterministic PRNG (mulberry32) for statistical tests that need a long,
 * reproducible, roughly-uniform sequence rather than a fixed repeating value. */
function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
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

function findDish(library: PlannerDish[], id: string): PlannerDish {
  const dish = library.find((d) => d.id === id)
  if (!dish) throw new Error(`fixture dish ${id} not found`)
  return dish
}

describe("checkPreFlightGate", () => {
  it("blocks when library has 0 Breakfast dishes", () => {
    const result = checkPreFlightGate([
      {
        id: "l1",
        name: "Lunch 1",
        category: "MAIN",
        mealTime: "Lunch",
        isSpecial: false,
        flavors: [],
        ingredientNames: [],
        pairedDishIds: [],
      },
      {
        id: "l2",
        name: "Lunch 2",
        category: "SIDE",
        mealTime: "Lunch",
        isSpecial: false,
        flavors: [],
        ingredientNames: [],
        pairedDishIds: [],
      },
    ])
    expect(result.blocked).toBe(true)
    expect(result.errors.some((e) => e.includes("Breakfast"))).toBe(true)
  })

  it("blocks when library has 0 Main dishes", () => {
    const result = checkPreFlightGate(noMainLibrary)
    expect(result.blocked).toBe(true)
    expect(result.errors.some((e) => e.includes("Main"))).toBe(true)
  })

  it("blocks when library has 0 Side or Soup dishes", () => {
    const result = checkPreFlightGate(noSideOrSoupLibrary)
    expect(result.blocked).toBe(true)
    expect(result.errors.some((e) => e.includes("Side or Soup"))).toBe(true)
  })

  it("passes with 1 Main + 1 Side/Soup + 1 Breakfast", () => {
    const result = checkPreFlightGate(unpairedMainLibrary)
    expect(result.blocked).toBe(false)
    expect(result.errors).toHaveLength(0)
  })

  it("passes with valid library", () => {
    const result = checkPreFlightGate(normalLibrary)
    expect(result.blocked).toBe(false)
    expect(result.errors).toHaveLength(0)
  })

  it("blocks when the only Main is Special-flagged (special dishes don't fill regular slots)", () => {
    const result = checkPreFlightGate([
      { id: "b1", name: "Breakfast", category: "OTHER", mealTime: "Breakfast", isSpecial: false, flavors: [], ingredientNames: [], pairedDishIds: [] },
      { id: "m1", name: "Special Main", category: "MAIN", mealTime: "Lunch", isSpecial: true, flavors: [], ingredientNames: [], pairedDishIds: [] },
      { id: "s1", name: "Side", category: "SIDE", mealTime: "Lunch", isSpecial: false, flavors: [], ingredientNames: [], pairedDishIds: [] },
    ])
    expect(result.blocked).toBe(true)
    expect(result.errors.some((e) => e.includes("Main"))).toBe(true)
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
      expect(err.errors.some((m) => m.includes("Side or Soup"))).toBe(true)
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
      { id: "a", name: "A", category: "MAIN", mealTime: "Lunch", isSpecial: false, flavors: ["salty", "sweet"], ingredientNames: [], pairedDishIds: [] },
      { id: "b", name: "B", category: "SIDE", mealTime: "Lunch", isSpecial: false, flavors: ["salty", "spicy"], ingredientNames: [], pairedDishIds: [] },
    ]
    expect(hasFlavorCollision(dishes)).toBe(true)
  })

  it("hasFlavorCollision returns false for distinct flavors", () => {
    const dishes: PlannerDish[] = [
      { id: "a", name: "A", category: "MAIN", mealTime: "Lunch", isSpecial: false, flavors: ["salty"], ingredientNames: [], pairedDishIds: [] },
      { id: "b", name: "B", category: "SIDE", mealTime: "Lunch", isSpecial: false, flavors: ["sweet"], ingredientNames: [], pairedDishIds: [] },
    ]
    expect(hasFlavorCollision(dishes)).toBe(false)
  })

  it("sharesFlavor detects a common flavor", () => {
    expect(sharesFlavor({ flavors: ["salty", "sweet"] }, { flavors: ["sweet"] })).toBe(true)
    expect(sharesFlavor({ flavors: ["salty"] }, { flavors: ["sweet"] })).toBe(false)
  })

  it("wouldRepeat detects duplicate IDs", () => {
    const ids = new Set(["a", "b", "c"])
    expect(wouldRepeat(ids, "b")).toBe(true)
    expect(wouldRepeat(ids, "d")).toBe(false)
  })

  it("pickNonRepeatDish returns first non-repeating dish", () => {
    const candidates: PlannerDish[] = [
      { id: "a", name: "A", category: "MAIN", mealTime: "Lunch", isSpecial: false, flavors: [], ingredientNames: [], pairedDishIds: [] },
      { id: "b", name: "B", category: "MAIN", mealTime: "Lunch", isSpecial: false, flavors: [], ingredientNames: [], pairedDishIds: [] },
    ]
    const ids = new Set(["a"])
    const picked = pickNonRepeatDish(ids, candidates)
    expect(picked?.id).toBe("b")
  })

  it("pickNonRepeatDish returns null when all candidates are repeats", () => {
    const candidates: PlannerDish[] = [
      { id: "a", name: "A", category: "MAIN", mealTime: "Lunch", isSpecial: false, flavors: [], ingredientNames: [], pairedDishIds: [] },
    ]
    const ids = new Set(["a"])
    expect(pickNonRepeatDish(ids, candidates)).toBeNull()
  })

  describe("pickPairedSideOrSoup", () => {
    const main: PlannerDish = {
      id: "m1",
      name: "Main",
      category: "MAIN",
      mealTime: "Lunch",
      isSpecial: false,
      flavors: ["spicy"],
      ingredientNames: [],
      pairedDishIds: ["s1"],
    }
    const paired: PlannerDish = {
      id: "s1",
      name: "Paired Side",
      category: "SIDE",
      mealTime: "Lunch",
      isSpecial: false,
      flavors: ["fresh"],
      ingredientNames: [],
      pairedDishIds: ["m1"],
    }
    const unpaired: PlannerDish = {
      id: "s2",
      name: "Unpaired Side",
      category: "SIDE",
      mealTime: "Lunch",
      isSpecial: false,
      flavors: ["fresh"],
      ingredientNames: [],
      pairedDishIds: [],
    }

    it("picks from the Main's pairedDishIds when a paired candidate exists", () => {
      const result = pickPairedSideOrSoup({
        main,
        candidates: [paired, unpaired],
        weekAssignedIds: new Set(),
        preferSameFlavor: false,
      })
      expect(result.dish?.id).toBe("s1")
      expect(result.usedFallback).toBe(false)
    })

    it("falls back to the full candidate pool when the Main has no pairings", () => {
      const unpairedMain: PlannerDish = { ...main, pairedDishIds: [] }
      const result = pickPairedSideOrSoup({
        main: unpairedMain,
        candidates: [unpaired],
        weekAssignedIds: new Set(),
        preferSameFlavor: false,
      })
      expect(result.dish?.id).toBe("s2")
      expect(result.usedFallback).toBe(true)
    })

    it("relaxes to a repeat when every paired candidate was used this week", () => {
      const result = pickPairedSideOrSoup({
        main,
        candidates: [paired],
        weekAssignedIds: new Set(["s1"]),
        preferSameFlavor: false,
      })
      expect(result.dish?.id).toBe("s1")
      expect(result.forcedRepeat).toBe(true)
    })
  })

  describe("pickCompensatoryDish", () => {
    const main: PlannerDish = {
      id: "m1",
      name: "Main",
      category: "MAIN",
      mealTime: "Lunch",
      isSpecial: false,
      flavors: ["spicy"],
      ingredientNames: [],
      pairedDishIds: ["s1", "c1"],
    }
    const sideOrSoup: PlannerDish = {
      id: "s1",
      name: "Side",
      category: "SIDE",
      mealTime: "Lunch",
      isSpecial: false,
      flavors: ["spicy"],
      ingredientNames: [],
      pairedDishIds: ["m1", "c1"],
    }
    const doublyPaired: PlannerDish = {
      id: "c1",
      name: "Doubly Paired",
      category: "SNACK",
      mealTime: "Lunch",
      isSpecial: false,
      flavors: ["herby"],
      ingredientNames: [],
      pairedDishIds: ["m1", "s1"],
    }
    const unpairedClean: PlannerDish = {
      id: "c2",
      name: "Unpaired Clean",
      category: "SNACK",
      mealTime: "Lunch",
      isSpecial: false,
      flavors: ["herby"],
      ingredientNames: [],
      pairedDishIds: [],
    }

    it("prefers a dish paired to both Main and Side/Soup", () => {
      const result = pickCompensatoryDish({
        main,
        sideOrSoup,
        candidates: [doublyPaired, unpairedClean],
        weekAssignedIds: new Set(),
      })
      expect(result.dish?.id).toBe("c1")
      expect(result.usedFallback).toBe(false)
    })

    it("falls back to an unpaired flavor-clean pick when no dish is paired to both", () => {
      const result = pickCompensatoryDish({
        main,
        sideOrSoup,
        candidates: [unpairedClean],
        weekAssignedIds: new Set(),
      })
      expect(result.dish?.id).toBe("c2")
      expect(result.usedFallback).toBe(true)
    })

    it("returns null when no valid candidate exists via either path", () => {
      const flavorCollider: PlannerDish = { ...unpairedClean, id: "c3", flavors: ["spicy"] }
      const result = pickCompensatoryDish({
        main,
        sideOrSoup,
        candidates: [flavorCollider],
        weekAssignedIds: new Set(),
      })
      expect(result.dish).toBeNull()
    })
  })
})

describe("Special Day placement", () => {
  it("places exactly one special day per week on a weekend", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 7, random))
    const specials = getSpecialDayEntries(result)
    expect(specials).toHaveLength(1)
    const dayOfWeek = specials[0].date.getUTCDay()
    expect(dayOfWeek === 0 || dayOfWeek === 6).toBe(true)
  })

  it("places 2 special days across a 14-day plan, one per week", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 14, random))
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

  it("does not leak extra Special-flagged dishes into regular lunches (one special day/week, single dish)", () => {
    // Library with TWO Special-flagged dishes — only one is reserved for the
    // Special day; the other must never appear in a regular weekday lunch.
    const multiSpecialLibrary: PlannerDish[] = [
      { id: "b1", name: "Breakfast", category: "OTHER", mealTime: "Breakfast", isSpecial: false, flavors: ["sweet"], ingredientNames: ["oats"], pairedDishIds: [] },
      { id: "sp1", name: "Special A", category: "MAIN", mealTime: "Lunch", isSpecial: true, flavors: ["rich"], ingredientNames: ["a"], pairedDishIds: [] },
      { id: "sp2", name: "Special B", category: "SIDE", mealTime: "Lunch", isSpecial: true, flavors: ["bold"], ingredientNames: ["b"], pairedDishIds: [] },
      ...Array.from({ length: 4 }, (_, i) => ({ id: `m${i + 1}`, name: `Main ${i + 1}`, category: "MAIN" as const, mealTime: "Lunch" as const, isSpecial: false, flavors: [`mf${i}`], ingredientNames: [`mi${i}`], pairedDishIds: [] })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `s${i + 1}`, name: `Side ${i + 1}`, category: "SIDE" as const, mealTime: "Lunch" as const, isSpecial: false, flavors: [`sf${i}`], ingredientNames: [`si${i}`], pairedDishIds: [] })),
    ]
    const specialIds = new Set(["sp1", "sp2"])

    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(multiSpecialLibrary, 14, random))

    // Exactly one special day per 7-day week — no bogus second special day.
    expect(getSpecialDayEntries(result)).toHaveLength(2)

    const lunches = getLunchEntries(result)
    for (const lunch of lunches) {
      const hasSpecialDish = lunch.dishes.some((d) => specialIds.has(d.dishId))
      if (lunch.isSpecialDay) {
        // Special day: exactly one dish, and it's a Special-flagged one.
        expect(lunch.dishes).toHaveLength(1)
        expect(hasSpecialDish).toBe(true)
      } else {
        // Regular day: never contains a Special-flagged dish.
        expect(hasSpecialDish).toBe(false)
      }
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

  it("does not repeat breakfast dishes within a 7-day block", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 7, random))
    const breakfasts = getBreakfastEntries(result)
    const ids = breakfasts.map((b) => b.dishes[0].dishId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("emits INSUFFICIENT_BREAKFAST_VARIETY when repeat is forced", () => {
    const smallBreakfastLib: PlannerDish[] = [
      { id: "b1", name: "Only Breakfast", category: "OTHER", mealTime: "Breakfast", isSpecial: false, flavors: ["sweet"], ingredientNames: ["oats"], pairedDishIds: [] },
      { id: "l1", name: "Main 1", category: "MAIN", mealTime: "Lunch", isSpecial: false, flavors: ["a"], ingredientNames: ["x"], pairedDishIds: [] },
      { id: "l2", name: "Side 1", category: "SIDE", mealTime: "Lunch", isSpecial: false, flavors: ["b"], ingredientNames: ["y"], pairedDishIds: [] },
    ]
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(smallBreakfastLib, 7, random))
    const warnings = result.warnings.filter((w) => w.code === "INSUFFICIENT_BREAKFAST_VARIETY")
    expect(warnings.length).toBeGreaterThan(0)
  })

  it("allows breakfasts to repeat across weeks but not within a 7-day block", () => {
    // Exactly 7 breakfasts over 14 days: each block should hold all 7 with no
    // in-block repeat, while the same dishes recur the following week — and no
    // INSUFFICIENT_BREAKFAST_VARIETY warning fires, because nothing repeats
    // inside any 7-day window.
    const sevenBreakfastLib: PlannerDish[] = [
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `b${i + 1}`,
        name: `Breakfast ${i + 1}`,
        category: "OTHER" as const,
        mealTime: "Breakfast" as const,
        isSpecial: false,
        flavors: [`bflavor_${i}`],
        ingredientNames: [`b_ing_${i + 1}`],
        pairedDishIds: [],
      })),
      { id: "m1", name: "Main 1", category: "MAIN", mealTime: "Lunch", isSpecial: false, flavors: ["a"], ingredientNames: ["x"], pairedDishIds: [] },
      { id: "s1", name: "Side 1", category: "SIDE", mealTime: "Lunch", isSpecial: false, flavors: ["b"], ingredientNames: ["y"], pairedDishIds: [] },
    ]
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(sevenBreakfastLib, 14, random))
    const breakfasts = getBreakfastEntries(result)

    const week1 = breakfasts.slice(0, 7).map((b) => b.dishes[0].dishId)
    const week2 = breakfasts.slice(7, 14).map((b) => b.dishes[0].dishId)

    // No repeat inside either 7-day block.
    expect(new Set(week1).size).toBe(7)
    expect(new Set(week2).size).toBe(7)
    // The same dishes recur across weeks (period-wide uniqueness is gone).
    expect(new Set([...week1, ...week2]).size).toBe(7)
    // …and that cross-week recurrence is NOT flagged as a variety shortfall.
    expect(
      result.warnings.some((w) => w.code === "INSUFFICIENT_BREAKFAST_VARIETY")
    ).toBe(false)
  })
})

describe("Lunch — Main/Side pairing", () => {
  it("picks Side/Soup from Main's pairedDishIds when available", () => {
    const random = createSeededRandom(Array(500).fill(0.9)) // prefer different flavor
    const result = generatePlan(makeTestInput(triplePairedLibrary, 1, random))
    const lunch = getLunchEntries(result)[0]
    const main = findDish(triplePairedLibrary, "m1")
    expect(lunch.dishes[0].dishId).toBe(main.id)
    expect(lunch.dishes[1].dishId).toBe("s1")
  })

  it("falls back to flavor-based pick + NO_PAIRED_DISH_FALLBACK when Main has no pairings", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(unpairedMainLibrary, 1, random))
    const fallbackWarnings = result.warnings.filter(
      (w) => w.code === "NO_PAIRED_DISH_FALLBACK"
    )
    expect(fallbackWarnings.length).toBeGreaterThan(0)
    const lunch = getLunchEntries(result)[0]
    expect(lunch.dishes.length).toBeGreaterThanOrEqual(2)
  })

  it("prefers a same-flavor pairing when random() < 0.3 and a same-flavor candidate exists", () => {
    const random = createSeededRandom([0.05]) // always below threshold
    const result = generatePlan(makeTestInput(pairedMixedFlavorLibrary, 1, random))
    const lunch = getLunchEntries(result)[0]
    const sideId = lunch.dishes[1].dishId
    expect(sideId.startsWith("sf")).toBe(true)
  })

  it("prefers a different-flavor pairing otherwise", () => {
    const random = createSeededRandom([0.9]) // always above threshold
    const result = generatePlan(makeTestInput(pairedMixedFlavorLibrary, 1, random))
    const lunch = getLunchEntries(result)[0]
    const sideId = lunch.dishes[1].dishId
    expect(sideId.startsWith("df")).toBe(true)
  })

  it("emits FLAVOR_COLLISION_RELAXED whenever Main and Side/Soup share a flavor, regardless of cause", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(singleFlavorLibrary, 7, random))
    const warnings = result.warnings.filter((w) => w.code === "FLAVOR_COLLISION_RELAXED")
    expect(warnings.length).toBeGreaterThan(0)
  })

  it("Main and Side/Soup collide on flavor roughly 30% of the time across a large fixture", () => {
    const random = mulberry32(42)
    const durationDays = 700
    const result = generatePlan(makeTestInput(pairedMixedFlavorLibrary, durationDays, random))
    const lunches = getLunchEntries(result).filter((e) => !e.isSpecialDay)

    let collisions = 0
    for (const lunch of lunches) {
      const flavorSets = lunch.dishes.map(
        (d) => findDish(pairedMixedFlavorLibrary, d.dishId).flavors
      )
      if (hasFlavorCollision(flavorSets.map((flavors) => ({ flavors })))) {
        collisions++
      }
    }

    const rate = collisions / lunches.length
    expect(MAIN_SIDE_SAME_FLAVOR_PROBABILITY).toBe(0.3)
    expect(rate).toBeGreaterThan(0.2)
    expect(rate).toBeLessThan(0.4)
  })
})

describe("Lunch — compensatory dish", () => {
  it("adds a 3rd dish only when Main+Side collided", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(triplePairedLibrary, 1, random))
    const lunch = getLunchEntries(result)[0]
    expect(lunch.dishes).toHaveLength(3)
    expect(lunch.dishes[2].dishId).toBe("c1")
  })

  it("never adds a 3rd dish when Main+Side were already flavor-clean", () => {
    const random = createSeededRandom([0.9])
    const result = generatePlan(makeTestInput(pairedMixedFlavorLibrary, 1, random))
    const lunch = getLunchEntries(result)[0]
    expect(lunch.dishes).toHaveLength(2)
  })

  it("prefers a dish paired to both Main and Side/Soup over an unpaired flavor-clean candidate", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(triplePairedLibrary, 1, random))
    const lunch = getLunchEntries(result)[0]
    expect(lunch.dishes[2].dishId).toBe("c1")
    const fallbackWarnings = result.warnings.filter(
      (w) => w.code === "NO_PAIRED_DISH_FALLBACK"
    )
    expect(fallbackWarnings).toHaveLength(0)
  })

  it("falls back to an unpaired flavor-clean pick + NO_PAIRED_DISH_FALLBACK when no dish is paired to both", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(compensatoryFallbackLibrary, 1, random))
    const lunch = getLunchEntries(result)[0]
    expect(lunch.dishes).toHaveLength(3)
    expect(lunch.dishes[2].dishId).toBe("c1")
    const fallbackWarnings = result.warnings.filter(
      (w) => w.code === "NO_PAIRED_DISH_FALLBACK"
    )
    expect(fallbackWarnings.length).toBeGreaterThan(0)
  })

  it("stays at 2 dishes when no valid compensatory candidate exists via either path", () => {
    const noCompensatoryOption: PlannerDish[] = [
      { id: "b1", name: "Toast", category: "OTHER", mealTime: "Breakfast", isSpecial: false, flavors: ["sweet"], ingredientNames: [], pairedDishIds: [] },
      { id: "m1", name: "Main", category: "MAIN", mealTime: "Lunch", isSpecial: false, flavors: ["spicy"], ingredientNames: [], pairedDishIds: ["s1"] },
      { id: "s1", name: "Side", category: "SIDE", mealTime: "Lunch", isSpecial: false, flavors: ["spicy"], ingredientNames: [], pairedDishIds: ["m1"] },
    ]
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(noCompensatoryOption, 1, random))
    const lunch = getLunchEntries(result)[0]
    expect(lunch.dishes).toHaveLength(2)
  })
})

describe("Lunch — weekly repeat window", () => {
  it("resets the no-repeat window every 7 days", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(weeklyRepeatLibrary, 14, random))
    const lunches = getLunchEntries(result)
    const week1MainIds = lunches.slice(0, 7).map((l) => l.dishes[0].dishId)
    const week2MainIds = lunches.slice(7, 14).map((l) => l.dishes[0].dishId)
    expect(week1MainIds).toEqual(week2MainIds)
  })

  it("does not force a repeat within a single 7-day block when the pool is sufficient for that block", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(weeklyRepeatLibrary, 14, random))
    const warnings = result.warnings.filter((w) => w.code === "REPEAT_FORCED")
    expect(warnings).toHaveLength(0)
  })

  it("emits REPEAT_FORCED only when a single 7-day block's pool is insufficient", () => {
    const random = createSeededRandom(Array(500).fill(0.9))
    const result = generatePlan(makeTestInput(barelySufficientLibrary, 7, random))
    // barelySufficientLibrary has ~10 Mains for a 7-day block — sufficient,
    // so a smaller pool is needed to force it.
    const tinyLib: PlannerDish[] = [
      { id: "b1", name: "Breakfast 1", category: "OTHER", mealTime: "Breakfast", isSpecial: false, flavors: ["sweet"], ingredientNames: ["oats"], pairedDishIds: [] },
      { id: "b2", name: "Breakfast 2", category: "OTHER", mealTime: "Breakfast", isSpecial: false, flavors: ["savory"], ingredientNames: ["eggs"], pairedDishIds: [] },
      { id: "m1", name: "Main 1", category: "MAIN", mealTime: "Lunch", isSpecial: false, flavors: ["a"], ingredientNames: ["x"], pairedDishIds: [] },
      { id: "s1", name: "Side 1", category: "SIDE", mealTime: "Lunch", isSpecial: false, flavors: ["b"], ingredientNames: ["y"], pairedDishIds: [] },
    ]
    const forcedResult = generatePlan(makeTestInput(tinyLib, 7, random))
    const forcedWarnings = forcedResult.warnings.filter((w) => w.code === "REPEAT_FORCED")
    expect(forcedWarnings.length).toBeGreaterThan(0)

    expect(result.warnings.filter((w) => w.code === "REPEAT_FORCED")).toHaveLength(0)
  })
})

describe("Lunch — flavor uniqueness", () => {
  it("enforces flavor uniqueness within a lunch slot when a flavor-clean pick was possible", () => {
    const random = createSeededRandom([0.9]) // always prefers different flavor
    const result = generatePlan(makeTestInput(pairedMixedFlavorLibrary, 30, random))
    const lunches = getLunchEntries(result).filter((e) => !e.isSpecialDay)
    for (const l of lunches) {
      const allFlavors = l.dishes.flatMap((d) => findDish(pairedMixedFlavorLibrary, d.dishId).flavors)
      expect(new Set(allFlavors).size).toBe(allFlavors.length)
    }
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
    expect(getSpecialDayEntries(result)).toHaveLength(2)
  })

  it("handles 28-day duration (four 7-day weeks)", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 28, random))
    expect(getBreakfastEntries(result)).toHaveLength(28)
    expect(getLunchEntries(result)).toHaveLength(28)
    expect(getSpecialDayEntries(result)).toHaveLength(4)
  })

  it("handles 20-day duration (two full weeks + a 6-day trailing week)", () => {
    const random = createSeededRandom(Array(500).fill(0.5))
    const result = generatePlan(makeTestInput(normalLibrary, 20, random))
    expect(getBreakfastEntries(result)).toHaveLength(20)
    expect(getLunchEntries(result)).toHaveLength(20)
    expect(getSpecialDayEntries(result)).toHaveLength(3)
  })
})
