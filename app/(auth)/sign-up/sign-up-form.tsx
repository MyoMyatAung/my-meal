"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signup } from "@/app/actions/auth"

export function SignUpForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setFieldErrors({})

    const formData = new FormData(e.currentTarget)

    try {
      const result = await signup(formData)
      if (!result.success) {
        setError(result.error)
        if ("fieldErrors" in result && result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        return
      }

      const signInResult = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      })

      if (signInResult?.error) {
        router.push("/sign-in?created=1")
        return
      }

      router.push("/")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Name</span>
        <Input
          type="text"
          name="name"
          placeholder="Alex Tran"
          autoComplete="name"
          required
        />
        {fieldErrors.name && (
          <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
        )}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Email</span>
        <Input
          type="email"
          name="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        {fieldErrors.email && (
          <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
        )}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Password</span>
        <Input
          type="password"
          name="password"
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />
        {fieldErrors.password && (
          <p className="text-xs text-destructive">{fieldErrors.password[0]}</p>
        )}
      </label>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
