import { getServerSession } from "next-auth/next"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { getCurrentPlan, getDishCounts } from "@/app/actions/plan"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCalendarDate, parseCalendarDate } from "@/lib/utils/date"
import {
  MIN_BREAKFAST_DISHES,
  MIN_LUNCH_DISHES,
} from "@/lib/planner/gate"
import {
  TriangleAlert,
  CalendarDays,
  ShoppingCart,
  Utensils,
  History,
} from "lucide-react"

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const [plan, counts] = await Promise.all([getCurrentPlan(), getDishCounts()])

  const isBlocked =
    counts.breakfast < MIN_BREAKFAST_DISHES ||
    counts.lunch < MIN_LUNCH_DISHES

  const now = new Date()
  const greetingDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const getGreeting = () => {
    const hour = now.getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }

  const planStartDate = plan
    ? formatCalendarDate(parseCalendarDate(plan.startDate.toISOString().slice(0, 10)), {
        month: "short",
        day: "numeric",
      })
    : null
  const planEndDate = plan
    ? formatCalendarDate(parseCalendarDate(plan.endDate.toISOString().slice(0, 10)), {
        month: "short",
        day: "numeric",
      })
    : null

  return (
    <div>
      <h1 className="text-lg font-semibold">
        {getGreeting()}, {session?.user?.name}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">{greetingDate}</p>

      {isBlocked && (
        <Card className="mb-6 border-warning bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm">
                You need at least {MIN_BREAKFAST_DISHES} Breakfast dish and{" "}
                {MIN_LUNCH_DISHES} Lunch dishes to generate a plan.
              </p>
              <Link
                href="/dishes"
                className="mt-1 inline-block text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                Add dishes →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {plan && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current plan
              </p>
              <p className="mb-1 text-sm font-semibold">
                {planStartDate} – {planEndDate}
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                {plan.entries.filter((e) => e.mealTime === "Breakfast").length} breakfasts ·{" "}
                {plan.entries.filter((e) => e.mealTime === "Lunch").length} lunches
              </p>
              <Link
                href="/plan"
                className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                View plan →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Shopping list
              </p>
              <p className="mb-1 text-sm font-semibold">
                {plan.shoppingItems.filter((i) => i.isChecked).length} of{" "}
                {plan.shoppingItems.length} checked
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                From your current plan
              </p>
              <Link
                href="/shopping-list"
                className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                Open list →
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Quick links
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/dishes">
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-3 p-4">
                <Utensils className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Dishes</p>
                  <p className="text-xs text-muted-foreground">
                    Manage your dish library
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/plan">
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-3 p-4">
                <CalendarDays className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Generate new plan</p>
                  <p className="text-xs text-muted-foreground">
                    Create a weekly meal plan
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/history">
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-3 p-4">
                <History className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">History</p>
                  <p className="text-xs text-muted-foreground">
                    Browse past plans
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
