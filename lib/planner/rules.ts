import type { PlannerDish } from "./types"

export function hasFlavorCollision(dishes: { flavors: string[] }[]): boolean {
  const allFlavors = dishes.flatMap((d) => d.flavors)
  return allFlavors.length !== new Set(allFlavors).size
}

export function wouldRepeat(assignedIds: Set<string>, candidateId: string): boolean {
  return assignedIds.has(candidateId)
}

export function pickNonRepeatDish(
  assignedIds: Set<string>,
  candidates: PlannerDish[]
): PlannerDish | null {
  const available = candidates.filter((d) => !assignedIds.has(d.id))
  return available.length > 0 ? available[0] : null
}
