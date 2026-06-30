import type { PlannerDish } from "./types"

export interface GateResult {
  blocked: boolean
  errors: string[]
}

export function checkPreFlightGate(dishes: PlannerDish[]): GateResult {
  const breakfastCount = dishes.filter((d) => d.mealTime === "Breakfast").length
  const lunchCount = dishes.filter((d) => d.mealTime === "Lunch").length

  const errors: string[] = []

  if (breakfastCount < 1) {
    errors.push(
      `Not enough Breakfast dishes (need at least 1, have ${breakfastCount})`
    )
  }

  if (lunchCount < 2) {
    errors.push(
      `Not enough Lunch dishes (need at least 2, have ${lunchCount})`
    )
  }

  return { blocked: errors.length > 0, errors }
}
