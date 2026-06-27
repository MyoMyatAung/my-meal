import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  return <h1 className="text-lg font-semibold">Good morning, {session?.user?.name}</h1>
}
