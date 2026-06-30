import type { PlannerDish } from "./types"

export const MIN_BREAKFAST_DISHES = 1
export const MIN_LUNCH_DISHES = 2

export interface GateResult {
  blocked: boolean
  errors: string[]
}

export function checkPreFlightGate(dishes: PlannerDish[]): GateResult {
  const breakfastCount = dishes.filter((d) => d.mealTime === "Breakfast").length
  const lunchCount = dishes.filter((d) => d.mealTime === "Lunch").length

  const errors: string[] = []

  if (breakfastCount < MIN_BREAKFAST_DISHES) {
    errors.push(
      `Not enough Breakfast dishes (need at least ${MIN_BREAKFAST_DISHES}, have ${breakfastCount})`
    )
  }

  if (lunchCount < MIN_LUNCH_DISHES) {
    errors.push(
      `Not enough Lunch dishes (need at least ${MIN_LUNCH_DISHES}, have ${lunchCount})`
    )
  }

  return { blocked: errors.length > 0, errors }
}
