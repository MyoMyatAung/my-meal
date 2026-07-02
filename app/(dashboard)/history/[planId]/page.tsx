import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getPlanById } from "@/app/actions/plan"
import { DayCard } from "@/components/day-card"
import { PlanWarningsCarousel } from "@/components/plan-warnings-carousel"
import { buildWarningCards } from "@/lib/utils/warning-cards"
import { buildEntriesByDate, buildWeeksFromDateKeys } from "@/lib/utils/plan-grouping"
import { formatCalendarDate, parseCalendarDate } from "@/lib/utils/date"

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  const plan = await getPlanById(planId)

  if (!plan) redirect("/history")

  const startDate = parseCalendarDate(plan.startDate.toISOString().slice(0, 10))
  const endDate = parseCalendarDate(plan.endDate.toISOString().slice(0, 10))
  const dateRange = `${formatCalendarDate(startDate, { month: "short", day: "numeric" })} – ${formatCalendarDate(endDate, { month: "short", day: "numeric" })}`

  const entriesByDate = buildEntriesByDate(
    plan.entries.map((e) => ({ ...e, date: e.date.toISOString() }))
  )
  const weeks = buildWeeksFromDateKeys(Array.from(entriesByDate.keys()))

  const rawWarnings = (plan.warnings as ({ code: string; message: string } | string)[]) ?? []
  const planWarningMessages = rawWarnings.map((warning) =>
    typeof warning === "string" ? warning : warning.message
  )
  const warningCards = buildWarningCards(
    planWarningMessages,
    plan.entries.map((entry) => ({
      date: entry.date.toISOString().slice(0, 10),
      entryWarnings: entry.entryWarnings,
    }))
  )

  return (
    <div>
      <Link
        href="/history"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Past plans
      </Link>

      <h1 className="mb-6 text-lg font-semibold">{dateRange}</h1>

      <PlanWarningsCarousel warnings={warningCards} />

      {weeks.map((week) => (
        <div key={week.label} className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            ── {week.label} ──
          </h2>
          <div className="space-y-3">
            {week.dates.map((dateKey) => {
              const day = entriesByDate.get(dateKey)!
              return (
                <DayCard
                  key={dateKey}
                  date={parseCalendarDate(dateKey)}
                  breakfast={day.breakfast}
                  lunch={day.lunch}
                  isSpecialDay={day.isSpecialDay}
                  warnings={day.warnings}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
