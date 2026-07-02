import Link from "next/link"
import { Calendar, ChevronRight } from "lucide-react"
import { getPlanHistory } from "@/app/actions/plan"
import { Card, CardContent } from "@/components/ui/card"
import { formatCalendarDate, parseCalendarDate } from "@/lib/utils/date"

export default async function HistoryPage() {
  const plans = await getPlanHistory()

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Past plans</h1>

      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No past plans yet —{" "}
          <Link href="/plan" className="underline underline-offset-4">
            generate a plan
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const start = parseCalendarDate(plan.startDate.toISOString().slice(0, 10))
            const end = parseCalendarDate(plan.endDate.toISOString().slice(0, 10))
            return (
              <Link key={plan.id} href={`/history/${plan.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="size-5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">
                          {formatCalendarDate(start, { month: "short", day: "numeric" })}
                          {" – "}
                          {formatCalendarDate(end, { month: "short", day: "numeric" })}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {plan.dayCount} days · {plan.ingredientCount} ingredients
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
