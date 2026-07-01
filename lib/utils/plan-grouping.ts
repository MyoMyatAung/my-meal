interface RawEntryDish {
  id: string
  sortOrder: number
  dish: {
    id: string
    name: string
    isSpecial: boolean
  }
}

interface RawPlanEntry {
  id: string
  date: string
  mealTime: "Breakfast" | "Lunch"
  entryWarnings: string[]
  dishes: RawEntryDish[]
}

export interface GroupedDay {
  breakfast: {
    dishId: string
    entryDishId: string
    dishName: string
  }[]
  lunch: {
    dishId: string
    entryDishId: string
    dishName: string
    sortOrder: number
    isSpecial: boolean
  }[]
  isSpecialDay: boolean
  warnings: string[]
}

export function buildEntriesByDate(entries: RawPlanEntry[]) {
  const entriesByDate = new Map<string, GroupedDay>()

  for (const entry of entries) {
    const dateKey = new Date(entry.date).toISOString().slice(0, 10)

    if (!entriesByDate.has(dateKey)) {
      entriesByDate.set(dateKey, {
        breakfast: [],
        lunch: [],
        isSpecialDay: false,
        warnings: [],
      })
    }

    const day = entriesByDate.get(dateKey)!

    if (entry.entryWarnings.length > 0) {
      day.warnings.push(...entry.entryWarnings)
    }

    if (entry.mealTime === "Breakfast") {
      for (const dish of entry.dishes) {
        day.breakfast.push({
          dishId: dish.dish.id,
          entryDishId: dish.id,
          dishName: dish.dish.name,
        })
      }
    } else {
      const hasSpecial = entry.dishes.some((dish) => dish.dish.isSpecial)
      if (hasSpecial) day.isSpecialDay = true

      for (const dish of entry.dishes) {
        day.lunch.push({
          dishId: dish.dish.id,
          entryDishId: dish.id,
          dishName: dish.dish.name,
          sortOrder: dish.sortOrder,
          isSpecial: dish.dish.isSpecial,
        })
      }
    }
  }

  return entriesByDate
}

export function buildWeeksFromDateKeys(dateKeys: string[]) {
  const sortedDateKeys = [...dateKeys].sort()
  const weeks: { label: string; dates: string[] }[] = []

  for (let i = 0; i < sortedDateKeys.length; i += 7) {
    const chunk = sortedDateKeys.slice(i, i + 7)
    const weekNum = Math.floor(i / 7) + 1

    weeks.push({
      label: `Week ${weekNum}`,
      dates: chunk,
    })
  }

  return weeks
}
