"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateNameAction } from "@/app/actions/settings"

export function UpdateNameForm({ currentName }: { currentName: string }) {
  const router = useRouter()
  const { update } = useSession()
  const [name, setName] = useState(currentName)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)

    const result = await updateNameAction({ name })
    setPending(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    await update({ name: result.data.name })
    router.refresh()
    toast.success("Name updated")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Name</span>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save name"}
      </Button>
    </form>
  )
}
