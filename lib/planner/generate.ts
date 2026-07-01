import type {
  GenerationInput,
  GenerationOutput,
  PlannerDish,
  PlannerEntry,
  PlannerEntryDish,
  PlannerWarning,
  ShoppingItem,
} from "./types"
import { checkPreFlightGate } from "./gate"
import { hasFlavorCollision, pickNonRepeatDish, wouldRepeat } from "./rules"

export class PreFlightGateError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "))
    this.name = "PreFlightGateError"
  }
}

export const LUNCH_THREE_DISH_PROBABILITY = 0.2

function shuffle<T>(array: T[], random: () => number): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

function getFlavorSets(dishes: PlannerDish[]): Set<string>[] {
  return dishes.map((d) => new Set(d.flavors))
}

function areFlavorClean(a: Set<string>, b: Set<string>): boolean {
  for (const f of a) {
    if (b.has(f)) return false
  }
  return true
}

interface WindowInfoFull {
  startOffset: number
  length: number
  weekendOffsets: number[]
}

function buildWindowInfos(
  startDate: Date,
  durationDays: number
): WindowInfoFull[] {
  const windows: WindowInfoFull[] = []

  for (let wStart = 0; wStart < durationDays; wStart += 14) {
    const wLen = Math.min(14, durationDays - wStart)
    const weekendOffsets: number[] = []

    for (let d = 0; d < wLen; d++) {
      const date = addDays(startDate, wStart + d)
      if (isWeekend(date)) {
        weekendOffsets.push(d)
      }
    }

    windows.push({
      startOffset: wStart,
      length: wLen,
      weekendOffsets,
    })
  }

  return windows
}

export function generatePlan(input: GenerationInput): GenerationOutput {
  const { dishes, startDate, durationDays } = input
  const random = input.random ?? Math.random

  const gateResult = checkPreFlightGate(dishes)
  if (gateResult.blocked) {
    throw new PreFlightGateError(gateResult.errors)
  }

  const breakfastDishes = shuffle(
    dishes.filter((d) => d.mealTime === "Breakfast"),
    random
  )
  const lunchDishes = shuffle(
    dishes.filter((d) => d.mealTime === "Lunch"),
    random
  )

  const specialDish = lunchDishes.find((d) => d.isSpecial)
  const hasSpecialDish = specialDish !== undefined

  const warnings: PlannerWarning[] = []
  if (!hasSpecialDish) {
    warnings.push({
      code: "NO_SPECIAL_DISH",
      message: "No Special dish available — all lunch days will have 2–3 regular dishes.",
    })
  }

  const windowInfos = buildWindowInfos(startDate, durationDays)
  const specialDayOffsets = new Set<number>()

  if (hasSpecialDish) {
    for (const window of windowInfos) {
      if (window.weekendOffsets.length > 0) {
        const pickIndex = Math.floor(random() * window.weekendOffsets.length)
        specialDayOffsets.add(window.startOffset + window.weekendOffsets[pickIndex])
      }
    }
  }

  const assignedBreakfastIds = new Set<string>()
  const assignedLunchIds = new Set<string>()

  if (hasSpecialDish && specialDish) {
    assignedLunchIds.add(specialDish.id)
  }
  const entries: PlannerEntry[] = []
  const usedIngredients: { ingredientName: string; dishName: string }[] = []

  let insufficientBreakfastWarned = false
  let flavorCollisionWarned = false
  let repeatForcedWarned = false

  for (let dayOffset = 0; dayOffset < durationDays; dayOffset++) {
    const date = addDays(startOfDay(startDate), dayOffset)
    const isSpecialDay = specialDayOffsets.has(dayOffset)

    const breakfastCandidates = breakfastDishes.filter(
      (d) => !assignedBreakfastIds.has(d.id)
    )
    let breakfastDish = breakfastCandidates[0]
    if (!breakfastDish) {
      if (!insufficientBreakfastWarned) {
        warnings.push({
          code: "INSUFFICIENT_BREAKFAST_VARIETY",
          message: "Not enough Breakfast dishes to avoid repeats — some breakfasts will repeat.",
        })
        insufficientBreakfastWarned = true
      }
      breakfastDish = breakfastDishes[0]
    }
    assignedBreakfastIds.add(breakfastDish.id)

    entries.push({
      date,
      mealTime: "Breakfast",
      dishes: [
        {
          dishId: breakfastDish.id,
          dishName: breakfastDish.name,
          sortOrder: 0,
        },
      ],
      isSpecialDay,
    })

    for (const ingredient of breakfastDish.ingredientNames) {
      usedIngredients.push({
        ingredientName: ingredient,
        dishName: breakfastDish.name,
      })
    }

    if (isSpecialDay && hasSpecialDish && specialDish) {
      assignedLunchIds.add(specialDish.id)

      entries.push({
        date,
        mealTime: "Lunch",
        dishes: [
          {
            dishId: specialDish.id,
            dishName: specialDish.name,
            sortOrder: 0,
          },
        ],
        isSpecialDay: true,
      })

      for (const ingredient of specialDish.ingredientNames) {
        usedIngredients.push({
          ingredientName: ingredient,
          dishName: specialDish.name,
        })
      }
    } else {
      const lunchSlotDishes: PlannerEntryDish[] = []

      const nonRepeatCandidates = lunchDishes.filter(
        (d) => !assignedLunchIds.has(d.id)
      )
      const flavorSets = getFlavorSets(nonRepeatCandidates)

      const flavorCleanCandidates: PlannerDish[] = []
      const flavorCleanSets: Set<string>[] = []

      for (let i = 0; i < nonRepeatCandidates.length; i++) {
        let isClean = true
        for (const existing of flavorCleanSets) {
          if (!areFlavorClean(existing, flavorSets[i])) {
            isClean = false
            break
          }
        }
        if (isClean) {
          flavorCleanCandidates.push(nonRepeatCandidates[i])
          flavorCleanSets.push(flavorSets[i])
        }
      }

      let useThree = false
      if (flavorCleanCandidates.length >= 3) {
        useThree = random() < LUNCH_THREE_DISH_PROBABILITY
      }

      let selectedCandidates = flavorCleanCandidates
      let relaxType: "flavor" | "repeat" | null = null

      if (selectedCandidates.length < 2) {
        selectedCandidates = nonRepeatCandidates
        if (selectedCandidates.length < 2) {
          relaxType = "repeat"
          selectedCandidates = lunchDishes
        } else {
          relaxType = "flavor"
        }
      } else if (useThree && selectedCandidates.length >= 3) {
        // Keep the 3 from flavorCleanCandidates
      } else {
        selectedCandidates = selectedCandidates.slice(0, 2)
      }

      if (relaxType === "flavor" && !flavorCollisionWarned) {
        warnings.push({
          code: "FLAVOR_COLLISION_RELAXED",
          message: "Not enough flavor-distinct lunch dishes — some lunch slots have overlapping flavors.",
        })
        flavorCollisionWarned = true
      } else if (relaxType === "repeat" && !repeatForcedWarned) {
        warnings.push({
          code: "REPEAT_FORCED",
          message: "Not enough lunch dishes to avoid repeats — some lunches will repeat.",
        })
        repeatForcedWarned = true
      }

      const dishCount = useThree && selectedCandidates.length >= 3 ? 3 : Math.min(2, selectedCandidates.length)

      for (let i = 0; i < dishCount; i++) {
        const dish = selectedCandidates[i]
        assignedLunchIds.add(dish.id)
        lunchSlotDishes.push({
          dishId: dish.id,
          dishName: dish.name,
          sortOrder: i,
        })

        for (const ingredient of dish.ingredientNames) {
          usedIngredients.push({
            ingredientName: ingredient,
            dishName: dish.name,
          })
        }
      }

      entries.push({
        date,
        mealTime: "Lunch",
        dishes: lunchSlotDishes,
        isSpecialDay: false,
      })
    }
  }

  const shoppingItemMap = new Map<string, string>()
  for (const item of usedIngredients) {
    if (!shoppingItemMap.has(item.ingredientName)) {
      shoppingItemMap.set(item.ingredientName, item.dishName)
    }
  }

  const shoppingItems: ShoppingItem[] = Array.from(
    shoppingItemMap.entries()
  ).map(([ingredientName, dishName]) => ({
    ingredientName,
    dishName,
  }))

  return { entries, warnings, shoppingItems }
}
