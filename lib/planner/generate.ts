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
import { hasFlavorCollision, pickPairedSideOrSoup, pickCompensatoryDish } from "./rules"

export class PreFlightGateError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "))
    this.name = "PreFlightGateError"
  }
}

export const MAIN_SIDE_SAME_FLAVOR_PROBABILITY = 0.3

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

  for (let wStart = 0; wStart < durationDays; wStart += 7) {
    const wLen = Math.min(7, durationDays - wStart)
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

  // Regular (non-special) Main/Side/Soup/compensatory picks are drawn from
  // the Lunch pool minus *every* Special-flagged dish. Special dishes belong
  // only on their designated Special day — excluding just the one reserved
  // special dish let any *other* Special-flagged dish leak into the regular
  // pool and get served as an ordinary weekday Main/Side, which surfaced as a
  // bogus second "Special day" (and a multi-dish "special" lunch) in the UI.
  const regularLunchPool = lunchDishes.filter((d) => !d.isSpecial)
  const mainPool = regularLunchPool.filter((d) => d.category === "MAIN")
  const sideOrSoupPool = regularLunchPool.filter(
    (d) => d.category === "SIDE" || d.category === "SOUP"
  )
  const compensatoryPool = regularLunchPool.filter(
    (d) =>
      d.category === "SNACK" ||
      d.category === "ACCOMPANIMENTS" ||
      d.category === "OTHER"
  )

  const entries: PlannerEntry[] = []
  const usedIngredients: { ingredientName: string; dishName: string }[] = []

  let insufficientBreakfastWarned = false
  let flavorCollisionWarned = false
  let repeatForcedWarned = false
  let pairedFallbackWarned = false
  let compensatoryFallbackWarned = false

  let currentWeekBlock = -1
  let weekLunchIds = new Set<string>()
  let weekBreakfastIds = new Set<string>()
  let breakfastCursor = 0

  for (let dayOffset = 0; dayOffset < durationDays; dayOffset++) {
    const date = addDays(startOfDay(startDate), dayOffset)
    const isSpecialDay = specialDayOffsets.has(dayOffset)

    const weekBlock = Math.floor(dayOffset / 7)
    if (weekBlock !== currentWeekBlock) {
      currentWeekBlock = weekBlock
      weekLunchIds = new Set<string>()
      weekBreakfastIds = new Set<string>()
    }

    // ─── Breakfast (per-7-day-block no-repeat, mirroring Lunch) ────────
    // Round-robin through the shuffled pool so that, when the library has
    // fewer breakfasts than the plan is long, repeats are spread evenly
    // across the period instead of the same dish landing several days in a
    // row. With ≥7 breakfasts this never repeats inside any 7-day block.
    const breakfastDish =
      breakfastDishes[breakfastCursor % breakfastDishes.length]
    breakfastCursor++

    if (weekBreakfastIds.has(breakfastDish.id) && !insufficientBreakfastWarned) {
      warnings.push({
        code: "INSUFFICIENT_BREAKFAST_VARIETY",
        message:
          "Not enough Breakfast dishes to avoid repeats within a 7-day window — some breakfasts will repeat.",
      })
      insufficientBreakfastWarned = true
    }
    weekBreakfastIds.add(breakfastDish.id)

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

    // ─── Lunch ─────────────────────────────────────────────────────────
    if (isSpecialDay && hasSpecialDish && specialDish) {
      weekLunchIds.add(specialDish.id)

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

      // Main
      const mainNonRepeat = mainPool.filter((d) => !weekLunchIds.has(d.id))
      let mainForcedRepeat = false
      let main: PlannerDish
      if (mainNonRepeat.length > 0) {
        main = mainNonRepeat[0]
      } else {
        mainForcedRepeat = true
        main = mainPool[0]
      }

      weekLunchIds.add(main.id)
      lunchSlotDishes.push({ dishId: main.id, dishName: main.name, sortOrder: 0 })
      for (const ingredient of main.ingredientNames) {
        usedIngredients.push({ ingredientName: ingredient, dishName: main.name })
      }

      // Side/Soup — drawn from the Main's pairings when available
      const preferSameFlavor = random() < MAIN_SIDE_SAME_FLAVOR_PROBABILITY
      const sideResult = pickPairedSideOrSoup({
        main,
        candidates: sideOrSoupPool,
        weekAssignedIds: weekLunchIds,
        preferSameFlavor,
      })

      let flavorCollisionOccurred = false
      let sideOrSoup: PlannerDish | null = null

      if (sideResult.dish) {
        sideOrSoup = sideResult.dish
        weekLunchIds.add(sideOrSoup.id)
        lunchSlotDishes.push({
          dishId: sideOrSoup.id,
          dishName: sideOrSoup.name,
          sortOrder: 1,
        })
        for (const ingredient of sideOrSoup.ingredientNames) {
          usedIngredients.push({
            ingredientName: ingredient,
            dishName: sideOrSoup.name,
          })
        }

        if (sideResult.usedFallback && !pairedFallbackWarned) {
          warnings.push({
            code: "NO_PAIRED_DISH_FALLBACK",
            message:
              "No paired Side/Soup dish found for at least one Main course — used the flavor-based fallback pick instead.",
          })
          pairedFallbackWarned = true
        }

        if (
          (mainForcedRepeat || sideResult.forcedRepeat) &&
          !repeatForcedWarned
        ) {
          warnings.push({
            code: "REPEAT_FORCED",
            message:
              "Not enough Lunch dish variety to avoid repeats within a 7-day window — some lunches will repeat.",
          })
          repeatForcedWarned = true
        }

        if (hasFlavorCollision([main, sideOrSoup])) {
          flavorCollisionOccurred = true
          if (!flavorCollisionWarned) {
            warnings.push({
              code: "FLAVOR_COLLISION_RELAXED",
              message:
                "A Main course and its paired Side/Soup share a flavor — allowed as an occasional relaxation.",
            })
            flavorCollisionWarned = true
          }
        }
      } else if (mainForcedRepeat && !repeatForcedWarned) {
        warnings.push({
          code: "REPEAT_FORCED",
          message:
            "Not enough Lunch dish variety to avoid repeats within a 7-day window — some lunches will repeat.",
        })
        repeatForcedWarned = true
      }

      // Optional compensatory 3rd dish — only when Main+Side/Soup collided
      if (flavorCollisionOccurred && sideOrSoup) {
        const compResult = pickCompensatoryDish({
          main,
          sideOrSoup,
          candidates: compensatoryPool,
          weekAssignedIds: weekLunchIds,
        })

        if (compResult.dish) {
          const compensatoryDish = compResult.dish
          weekLunchIds.add(compensatoryDish.id)
          lunchSlotDishes.push({
            dishId: compensatoryDish.id,
            dishName: compensatoryDish.name,
            sortOrder: 2,
          })
          for (const ingredient of compensatoryDish.ingredientNames) {
            usedIngredients.push({
              ingredientName: ingredient,
              dishName: compensatoryDish.name,
            })
          }

          if (compResult.usedFallback && !compensatoryFallbackWarned) {
            warnings.push({
              code: "NO_PAIRED_DISH_FALLBACK",
              message:
                "No dish paired to both the Main and Side/Soup was available for the bonus 3rd dish — used the flavor-based fallback pick instead.",
            })
            compensatoryFallbackWarned = true
          }
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
