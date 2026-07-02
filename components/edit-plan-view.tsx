"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DayCard } from "@/components/day-card"
import { PlanWarningsCarousel } from "@/components/plan-warnings-carousel"
import { buildWarningCards } from "@/lib/utils/warning-cards"
import { buildEntriesByDate, buildWeeksFromDateKeys } from "@/lib/utils/plan-grouping"

interface EditPlanViewProps {
  plan: {
    warnings: { code: string; message: string }[] | string[]
    entries: {
      id: string
      date: string
      mealTime: "Breakfast" | "Lunch"
      entryWarnings: string[]
      dishes: {
        id: string
        sortOrder: number
        dish: {
          id: string
          name: string
          isSpecial: boolean
        }
      }[]
    }[]
  }
  breakfastOptions: { id: string; name: string; isSpecial: boolean }[]
  lunchOptions: { id: string; name: string; isSpecial: boolean }[]
}

export function EditPlanView({
  plan,
  breakfastOptions,
  lunchOptions,
}: EditPlanViewProps) {
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
      <div className="mb-4">
        <Link
          href="/plan"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Plan view
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Edit plan</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/plan">Done</Link>
        </Button>
      </div>

      <PlanWarningsCarousel warnings={warningCards} />

      {weeks.map((week) => (
        <div key={week.label} className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            -- {week.label} --
          </h2>
          <div className="space-y-3">
            {week.dates.map((dateKey) => {
              const day = entriesByDate.get(dateKey)!
              return (
                <DayCard
                  key={dateKey}
                  date={new Date(`${dateKey}T00:00:00.000Z`)}
                  breakfast={day.breakfast}
                  lunch={day.lunch}
                  isSpecialDay={day.isSpecialDay}
                  warnings={day.warnings}
                  editable
                  swappableDishes={{
                    Breakfast: breakfastOptions,
                    Lunch: lunchOptions,
                  }}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
