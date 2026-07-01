import { hasFlavorCollision } from "./rules"

export interface WarningEntryDish {
  dishId: string
  dishName: string
  flavors: string[]
}

export interface WarningEntry {
  entryId: string
  mealTime: "Breakfast" | "Lunch"
  dishes: WarningEntryDish[]
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

  const byMealTime = new Map<"Breakfast" | "Lunch", WarningEntry[]>()
  for (const entry of entries) {
    byMealTime.set(entry.mealTime, [...(byMealTime.get(entry.mealTime) ?? []), entry])
  }

  for (const sameTime of byMealTime.values()) {
    const occurrences = new Map<string, { name: string; entryIds: Set<string> }>()
    for (const entry of sameTime) {
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
