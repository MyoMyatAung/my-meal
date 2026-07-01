import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getCurrentPlan } from "@/app/actions/plan"
import { GeneratePlanForm } from "@/components/generate-plan-form"
import { PlanView } from "@/components/plan-view"

export default async function PlanPage() {
  const session = await getServerSession(authOptions)
  const plan = await getCurrentPlan()

  const serializedPlan = plan
    ? JSON.parse(JSON.stringify(plan))
    : null

  return (
    <div>
      {serializedPlan ? (
        <PlanView plan={serializedPlan} />
      ) : (
        <GeneratePlanForm />
      )}
    </div>
  )
}
