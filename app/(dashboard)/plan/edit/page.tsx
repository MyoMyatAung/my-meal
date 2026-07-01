import { redirect } from "next/navigation"
import { getCurrentPlan, getSwappableDishes } from "@/app/actions/plan"
import { EditPlanView } from "@/components/edit-plan-view"

export default async function EditPlanPage() {
  const [plan, breakfastOptions, lunchOptions] = await Promise.all([
    getCurrentPlan(),
    getSwappableDishes("Breakfast"),
    getSwappableDishes("Lunch"),
  ])

  if (!plan) {
    redirect("/plan")
  }

  return (
    <EditPlanView
      plan={JSON.parse(JSON.stringify(plan))}
      breakfastOptions={breakfastOptions.success ? breakfastOptions.data.dishes : []}
      lunchOptions={lunchOptions.success ? lunchOptions.data.dishes : []}
    />
  )
}
