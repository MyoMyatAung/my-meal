"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DishPill } from "@/components/dish-pill"
import { EditableDishPill } from "@/components/editable-dish-pill"
import { formatCalendarDate } from "@/lib/utils/date"
import { Sun, TriangleAlert, Utensils } from "lucide-react"

interface DayCardProps {
  date: Date
  breakfast: { dishId: string; entryDishId: string; dishName: string }[]
  lunch: {
    dishId: string
    entryDishId: string
    dishName: string
    sortOrder: number
    isSpecial: boolean
  }[]
  isSpecialDay: boolean
  warnings?: string[]
  editable?: boolean
  swappableDishes?: {
    Breakfast: { id: string; name: string; isSpecial: boolean }[]
    Lunch: { id: string; name: string; isSpecial: boolean }[]
  }
}

export function DayCard({
  date,
  breakfast,
  lunch,
  isSpecialDay,
  warnings = [],
  editable = false,
  swappableDishes,
}: DayCardProps) {
  const hasWarnings = warnings.length > 0

  return (
    <Card
      className={[
        isSpecialDay ? "border-accent" : "",
        hasWarnings ? "border-destructive/40" : "",
      ].join(" ")}
    >
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {formatCalendarDate(date, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            {isSpecialDay && (
              <Badge className="ml-2 bg-accent text-accent-foreground">
                Special day
              </Badge>
            )}
          </h2>
          {hasWarnings && (
            <TriangleAlert className="size-4 text-destructive" aria-hidden="true" />
          )}
        </div>

        <div className="mb-2 flex items-center gap-2">
          <Sun className="size-3.5 text-muted-foreground" />
          <span className="w-16 text-xs text-muted-foreground">Breakfast</span>
          <div className="flex flex-wrap gap-1.5">
            {breakfast.map((d) => (
              editable && swappableDishes ? (
                <EditableDishPill
                  key={d.entryDishId}
                  entryDishId={d.entryDishId}
                  dishId={d.dishId}
                  dishName={d.dishName}
                  options={swappableDishes.Breakfast}
                  excludeIds={[]}
                />
              ) : (
                <DishPill key={d.entryDishId} name={d.dishName} />
              )
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Utensils className="size-3.5 text-muted-foreground" />
          <span className="w-16 text-xs text-muted-foreground">Lunch</span>
          <div className="flex flex-wrap gap-1.5">
            {lunch.map((d) => {
              const excludeIds = lunch
                .filter((dish) => dish.entryDishId !== d.entryDishId)
                .map((dish) => dish.dishId)

              return editable && swappableDishes ? (
                <EditableDishPill
                  key={d.entryDishId}
                  entryDishId={d.entryDishId}
                  dishId={d.dishId}
                  dishName={d.dishName}
                  isSpecial={d.isSpecial}
                  options={swappableDishes.Lunch}
                  excludeIds={excludeIds}
                />
              ) : (
                <DishPill key={d.entryDishId} name={d.dishName} isSpecial={d.isSpecial} />
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
