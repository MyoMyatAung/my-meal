import type { PlannerDish } from "./types"

export function hasFlavorCollision(dishes: { flavors: string[] }[]): boolean {
  const allFlavors = dishes.flatMap((d) => d.flavors)
  return allFlavors.length !== new Set(allFlavors).size
}

export function sharesFlavor(
  a: { flavors: string[] },
  b: { flavors: string[] }
): boolean {
  const bFlavors = new Set(b.flavors)
  return a.flavors.some((f) => bFlavors.has(f))
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

/**
 * Picks the mandatory Side/Soup dish for a given Main course.
 * `candidates` is the full (pre-shuffled) Side/Soup pool; this narrows it to
 * the Main's paired dishes when any exist, falling back to the full pool
 * (Phase 4's old flavor-based behavior) otherwise. Stays pure — the caller
 * decides which warnings to emit from `usedFallback`/`forcedRepeat`.
 */
export function pickPairedSideOrSoup(args: {
  main: PlannerDish
  candidates: PlannerDish[]
  weekAssignedIds: Set<string>
  preferSameFlavor: boolean
}): {
  dish: PlannerDish | null
  usedFallback: boolean
  forcedRepeat: boolean
} {
  const { main, candidates, weekAssignedIds, preferSameFlavor } = args

  const pairedIds = new Set(main.pairedDishIds)
  const pairedCandidates = candidates.filter((d) => pairedIds.has(d.id))

  const usedFallback = pairedCandidates.length === 0
  const pool = usedFallback ? candidates : pairedCandidates

  if (pool.length === 0) {
    return { dish: null, usedFallback, forcedRepeat: false }
  }

  const preferredSubset = pool.filter((d) =>
    preferSameFlavor ? sharesFlavor(main, d) : !sharesFlavor(main, d)
  )
  const workingPool = preferredSubset.length > 0 ? preferredSubset : pool

  const nonRepeatPool = workingPool.filter((d) => !weekAssignedIds.has(d.id))
  if (nonRepeatPool.length > 0) {
    return { dish: nonRepeatPool[0], usedFallback, forcedRepeat: false }
  }

  return { dish: workingPool[0], usedFallback, forcedRepeat: true }
}

/**
 * Picks the optional compensatory 3rd dish — must be paired to BOTH main
 * and sideOrSoup (intersection of their pairedDishIds), flavor-clean against
 * both. Falls back to an unpaired flavor-clean pick from the same category
 * pool if the intersection yields nothing usable.
 */
export function pickCompensatoryDish(args: {
  main: PlannerDish
  sideOrSoup: PlannerDish
  candidates: PlannerDish[]
  weekAssignedIds: Set<string>
}): {
  dish: PlannerDish | null
  usedFallback: boolean
} {
  const { main, sideOrSoup, candidates, weekAssignedIds } = args

  const mainPaired = new Set(main.pairedDishIds)
  const sidePaired = new Set(sideOrSoup.pairedDishIds)

  const flavorClean = (d: PlannerDish) =>
    !sharesFlavor(main, d) && !sharesFlavor(sideOrSoup, d)

  const doublyPaired = candidates.filter(
    (d) => mainPaired.has(d.id) && sidePaired.has(d.id) && flavorClean(d)
  )

  const doublyPairedNonRepeat = doublyPaired.filter(
    (d) => !weekAssignedIds.has(d.id)
  )
  if (doublyPairedNonRepeat.length > 0) {
    return { dish: doublyPairedNonRepeat[0], usedFallback: false }
  }
  if (doublyPaired.length > 0) {
    return { dish: doublyPaired[0], usedFallback: false }
  }

  const fallbackPool = candidates.filter(flavorClean)
  const fallbackNonRepeat = fallbackPool.filter((d) => !weekAssignedIds.has(d.id))
  if (fallbackNonRepeat.length > 0) {
    return { dish: fallbackNonRepeat[0], usedFallback: true }
  }
  if (fallbackPool.length > 0) {
    return { dish: fallbackPool[0], usedFallback: true }
  }

  return { dish: null, usedFallback: true }
}
