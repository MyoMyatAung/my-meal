import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { Sidebar } from "@/components/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/sign-in")
  }

  return (
    <div className="flex min-h-svh">
      <Sidebar user={session.user} />
      <main className="flex-1 pt-14 md:ml-54 md:pt-0">
        <div className="mx-auto max-w-3xl px-5 py-7 md:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
