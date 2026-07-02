import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { UpdateNameForm } from "@/components/update-name-form"
import { UpdatePasswordForm } from "@/components/update-password-form"
import { SignOutButton } from "@/components/sign-out-button"
import { Card, CardContent } from "@/components/ui/card"

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">Account settings</h1>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Profile</h2>
            <UpdateNameForm currentName={session?.user?.name ?? ""} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Password</h2>
            <UpdatePasswordForm />
          </CardContent>
        </Card>

        <SignOutButton />
      </div>
    </div>
  )
}
