import { hasFlavorCollision } from "./rules"

export interface WarningEntryDish {
  dishId: string
  dishName: string
  flavors: string[]
}

export interface WarningEntry {
  entryId: string
  date: Date
  mealTime: "Breakfast" | "Lunch"
  dishes: WarningEntryDish[]
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * 7-day block index relative to the earliest entry date — mirrors the
 * generator's `Math.floor(dayOffset / 7)` windowing so that "repeats
 * elsewhere" only fires for dishes recurring inside the same 7-day block
 * (both Breakfast and Lunch now share this weekly no-repeat rule).
 */
function blockIndex(date: Date, planStart: Date): number {
  const days = Math.floor(
    (startOfUTCDay(date) - startOfUTCDay(planStart)) / MS_PER_DAY
  )
  return Math.floor(days / 7)
}

function startOfUTCDay(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  )
}

export function computeEntryWarnings(entries: WarningEntry[]): Map<string, string[]> {
  const warnings = new Map<string, string[]>()

  const push = (entryId: string, message: string) => {
    warnings.set(entryId, [...(warnings.get(entryId) ?? []), message])
  }

  for (const entry of entries) {
    if (entry.mealTime !== "Lunch") continue
    if (hasFlavorCollision(entry.dishes)) {
      const flavor = findFirstDuplicateFlavor(entry.dishes)
      push(
        entry.entryId,
        flavor
          ? `Two lunch dishes share a flavor (${flavor}) - saved anyway`
          : "Two lunch dishes share a flavor - saved anyway"
      )
    }
  }

  // Repeats are scoped to a 7-day block: a dish may reappear in a later week
  // without warning, but repeating inside the same block is flagged.
  const planStart = entries.reduce<Date | null>(
    (earliest, entry) =>
      earliest === null || entry.date < earliest ? entry.date : earliest,
    null
  )

  if (planStart !== null) {
    const byGroup = new Map<string, WarningEntry[]>()
    for (const entry of entries) {
      const key = `${entry.mealTime}:${blockIndex(entry.date, planStart)}`
      byGroup.set(key, [...(byGroup.get(key) ?? []), entry])
    }

    for (const sameGroup of byGroup.values()) {
      const occurrences = new Map<string, { name: string; entryIds: Set<string> }>()
      for (const entry of sameGroup) {
        for (const dish of entry.dishes) {
          const record = occurrences.get(dish.dishId) ?? {
            name: dish.dishName,
            entryIds: new Set<string>(),
          }
          record.entryIds.add(entry.entryId)
          occurrences.set(dish.dishId, record)
        }
      }

      for (const { name, entryIds } of occurrences.values()) {
        if (entryIds.size > 1) {
          for (const entryId of entryIds) {
            push(entryId, `"${name}" repeats elsewhere in this plan - saved anyway`)
          }
        }
      }
    }
  }

  return warnings
}

function findFirstDuplicateFlavor(dishes: { flavors: string[] }[]): string | null {
  const seen = new Set<string>()
  for (const dish of dishes) {
    for (const flavor of dish.flavors) {
      if (seen.has(flavor)) return flavor
      seen.add(flavor)
    }
  }
  return null
}
