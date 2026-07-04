"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  const formattedDate = formatCalendarDate(date, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

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
            {formattedDate}
            {isSpecialDay && (
              <Badge className="ml-2 bg-accent text-accent-foreground">
                Special day
              </Badge>
            )}
          </h2>
          {hasWarnings && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-mr-1 text-destructive hover:text-destructive"
                  aria-label={`View ${warnings.length} warning${
                    warnings.length > 1 ? "s" : ""
                  } for ${formattedDate}`}
                >
                  <TriangleAlert className="size-4" aria-hidden="true" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <TriangleAlert
                      className="size-4 text-destructive"
                      aria-hidden="true"
                    />
                    Warnings — {formattedDate}
                  </DialogTitle>
                  <DialogDescription>
                    {warnings.length === 1
                      ? "This day has 1 warning."
                      : `This day has ${warnings.length} warnings.`}
                  </DialogDescription>
                </DialogHeader>
                <ul className="flex flex-col gap-2">
                  {warnings.map((warning, index) => (
                    <li
                      key={index}
                      className="flex gap-2 border border-destructive/30 bg-destructive/5 p-2 text-destructive"
                    >
                      <TriangleAlert
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </DialogContent>
            </Dialog>
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
