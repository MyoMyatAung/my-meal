"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DayCard } from "@/components/day-card"
import { GeneratePlanForm } from "@/components/generate-plan-form"
import { formatCalendarDate, parseCalendarDate } from "@/lib/utils/date"
import { AlertTriangle } from "lucide-react"

interface PlanViewProps {
  plan: {
    id: string
    startDate: string
    endDate: string
    warnings: { code: string; message: string }[]
    entries: {
      id: string
      date: string
      mealTime: "Breakfast" | "Lunch"
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

  // Group entries by date
  const entriesByDate = new Map<
    string,
    {
      breakfast: { dishId: string; dishName: string }[]
      lunch: {
        dishId: string
        dishName: string
        sortOrder: number
        isSpecial: boolean
      }[]
      isSpecialDay: boolean
    }
  >()

  for (const entry of plan.entries) {
    const dateKey = new Date(entry.date).toISOString().slice(0, 10)

    if (!entriesByDate.has(dateKey)) {
      entriesByDate.set(dateKey, { breakfast: [], lunch: [], isSpecialDay: false })
    }

    const day = entriesByDate.get(dateKey)!

    if (entry.mealTime === "Breakfast") {
      for (const d of entry.dishes) {
        day.breakfast.push({ dishId: d.dish.id, dishName: d.dish.name })
      }
    } else {
      const hasSpecial = entry.dishes.some((d) => d.dish.isSpecial)
      if (hasSpecial) day.isSpecialDay = true

      for (const d of entry.dishes) {
        day.lunch.push({
          dishId: d.dish.id,
          dishName: d.dish.name,
          sortOrder: d.sortOrder,
          isSpecial: d.dish.isSpecial,
        })
      }
    }
  }

  // Group into weeks (chunks of 7 days)
  const allDateKeys = Array.from(entriesByDate.keys()).sort()
  const weeks: { label: string; dates: string[] }[] = []

  for (let i = 0; i < allDateKeys.length; i += 7) {
    const chunk = allDateKeys.slice(i, i + 7)
    const weekStart = parseCalendarDate(chunk[0])
    const weekNum = Math.floor(i / 7) + 1
    weeks.push({
      label: `Week ${weekNum}`,
      dates: chunk,
    })
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{dateRange}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)}>
            Generate New Plan
          </Button>
          <Button variant="outline" size="sm" disabled>
            Edit plan
          </Button>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        History coming soon
      </p>

      {plan.warnings && plan.warnings.length > 0 && (
        <Card className="mb-6 border-warning bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="space-y-1">
              {plan.warnings.map((w, i) => (
                <p key={i} className="text-sm">
                  {w.message}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
