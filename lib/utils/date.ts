/**
 * Parses a "YYYY-MM-DD" wall-clock date string into a UTC-midnight Date.
 * Use this for any calendar-only field (MealPlan.startDate/endDate,
 * MealPlanEntry.date) — never `new Date(str)` directly on these, since
 * that's parsed against the server's local zone and can land on the
 * wrong UTC day.
 */
export function parseCalendarDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/**
 * Formats a calendar-only Date using UTC getters, so the displayed day
 * never shifts based on the viewer's local timezone.
 */
export function formatCalendarDate(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" })
}

/**
 * Adds `days` to a "YYYY-MM-DD" calendar date string and returns the
 * result in the same format. Used for the Generate form's end-date preview.
 */
export function addDaysToCalendarDate(dateStr: string, days: number): string {
  const d = parseCalendarDate(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
