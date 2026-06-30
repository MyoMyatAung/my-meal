import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DishPill } from "@/components/dish-pill"
import { formatCalendarDate } from "@/lib/utils/date"
import { Sun, Utensils } from "lucide-react"

interface DayCardProps {
  date: Date
  breakfast: { dishId: string; dishName: string }[]
  lunch: {
    dishId: string
    dishName: string
    sortOrder: number
    isSpecial: boolean
  }[]
  isSpecialDay: boolean
}

export function DayCard({ date, breakfast, lunch, isSpecialDay }: DayCardProps) {
  return (
    <Card className={isSpecialDay ? "border-accent" : ""}>
      <CardContent className="p-4">
        <h2 className="mb-3 text-sm font-semibold">
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

        <div className="mb-2 flex items-center gap-2">
          <Sun className="size-3.5 text-muted-foreground" />
          <span className="w-16 text-xs text-muted-foreground">Breakfast</span>
          <div className="flex flex-wrap gap-1.5">
            {breakfast.map((d) => (
              <DishPill key={d.dishId} name={d.dishName} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Utensils className="size-3.5 text-muted-foreground" />
          <span className="w-16 text-xs text-muted-foreground">Lunch</span>
          <div className="flex flex-wrap gap-1.5">
            {lunch.map((d) => (
              <DishPill key={d.dishId} name={d.dishName} isSpecial={d.isSpecial} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
