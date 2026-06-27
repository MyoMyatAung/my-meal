import { Card, CardContent } from "@/components/ui/card"
import { SignUpForm } from "./sign-up-form"

export default function SignUpPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardContent className="pt-6">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold">My Meal</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Plan meals, one calm week at a time.
          </p>
        </div>
        <SignUpForm />
      </CardContent>
    </Card>
  )
}
