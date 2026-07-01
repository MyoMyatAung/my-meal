export interface WarningCard {
  id: string
  message: string
  scope: "generation" | "edit"
  dates: string[]
}

interface EntryForWarnings {
  date: string
  entryWarnings: string[]
}

export function buildWarningCards(
  planWarnings: string[],
  entries: EntryForWarnings[]
): WarningCard[] {
  const cards: WarningCard[] = planWarnings.map((message, index) => ({
    id: `generation-${index}`,
    message,
    scope: "generation",
    dates: [],
  }))

  const byMessage = new Map<string, Set<string>>()
  for (const entry of entries) {
    for (const message of entry.entryWarnings) {
      const dates = byMessage.get(message) ?? new Set<string>()
      dates.add(entry.date)
      byMessage.set(message, dates)
    }
  }

  for (const [message, dates] of byMessage) {
    cards.push({
      id: `edit-${message}`,
      message,
      scope: "edit",
      dates: [...dates].sort(),
    })
  }

  return cards
}
