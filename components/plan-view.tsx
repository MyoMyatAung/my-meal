"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DayCard } from "@/components/day-card"
import { GeneratePlanForm } from "@/components/generate-plan-form"
import { formatCalendarDate, parseCalendarDate } from "@/lib/utils/date"
import { buildWarningCards } from "@/lib/utils/warning-cards"
import { PlanWarningsCarousel } from "@/components/plan-warnings-carousel"
import { buildEntriesByDate, buildWeeksFromDateKeys } from "@/lib/utils/plan-grouping"

interface PlanViewProps {
  plan: {
    id: string
    startDate: string
    endDate: string
    warnings: { code: string; message: string }[] | string[]
    entries: {
      id: string
      date: string
      mealTime: "Breakfast" | "Lunch"
      entryWarnings: string[]
      dishes: {
        id: string
        dish: {
          id: string
          name: string
          category: string
          isSpecial: boolean
        }
        sortOrder: number
      }[]
    }[]
  }
}

export function PlanView({ plan }: PlanViewProps) {
  const [showGenerate, setShowGenerate] = useState(false)

  if (showGenerate) {
    return <GeneratePlanForm />
  }

  const startDate = parseCalendarDate(plan.startDate.slice(0, 10))
  const endDate = parseCalendarDate(plan.endDate.slice(0, 10))

  const dateRange = `${formatCalendarDate(startDate, { month: "short", day: "numeric" })} – ${formatCalendarDate(endDate, { month: "short", day: "numeric" })}`

  const entriesByDate = buildEntriesByDate(plan.entries)
  const weeks = buildWeeksFromDateKeys(Array.from(entriesByDate.keys()))

  const planWarningMessages = (plan.warnings ?? []).map((warning) =>
    typeof warning === "string" ? warning : warning.message
  )

  const warningCards = buildWarningCards(
    planWarningMessages,
    plan.entries.map((entry) => ({
      date: new Date(entry.date).toISOString().slice(0, 10),
      entryWarnings: entry.entryWarnings,
    }))
  )

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{dateRange}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)}>
            Generate New Plan
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/plan/edit">Edit plan</Link>
          </Button>
        </div>
      </div>

      <Link
        href="/history"
        className="mb-4 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        View past plans →
      </Link>

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
