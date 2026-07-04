import type { PlannerDish } from "./types"

export const MIN_BREAKFAST_DISHES = 1
export const MIN_MAIN_DISHES = 1
export const MIN_SIDE_OR_SOUP_DISHES = 1

export interface GateResult {
  blocked: boolean
  errors: string[]
}

export function checkPreFlightGate(dishes: PlannerDish[]): GateResult {
  const breakfastCount = dishes.filter((d) => d.mealTime === "Breakfast").length
  // Special-flagged dishes are reserved for the Special day and are excluded
  // from the regular Main/Side/Soup pool in generate.ts, so they can't satisfy
  // the "at least one regular Main / Side-or-Soup" requirement a normal lunch
  // needs. Count only non-special dishes here to keep the gate honest.
  const mainCount = dishes.filter(
    (d) => d.mealTime === "Lunch" && d.category === "MAIN" && !d.isSpecial
  ).length
  const sideOrSoupCount = dishes.filter(
    (d) =>
      d.mealTime === "Lunch" &&
      (d.category === "SIDE" || d.category === "SOUP") &&
      !d.isSpecial
  ).length

  const errors: string[] = []

  if (breakfastCount < MIN_BREAKFAST_DISHES) {
    errors.push(
      `Not enough Breakfast dishes (need at least ${MIN_BREAKFAST_DISHES}, have ${breakfastCount})`
    )
  }

  if (mainCount < MIN_MAIN_DISHES) {
    errors.push(
      `Not enough Main dishes (need at least ${MIN_MAIN_DISHES}, have ${mainCount})`
    )
  }

  if (sideOrSoupCount < MIN_SIDE_OR_SOUP_DISHES) {
    errors.push(
      `Not enough Side or Soup dishes (need at least ${MIN_SIDE_OR_SOUP_DISHES}, have ${sideOrSoupCount})`
    )
  }

  return { blocked: errors.length > 0, errors }
}
