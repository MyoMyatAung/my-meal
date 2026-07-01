"use client"

import { useMemo } from "react"

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function GreetingHeader({ name }: { name?: string | null }) {
  const { greeting, greetingDate } = useMemo(() => {
    const now = new Date()
    return {
      greeting: getGreeting(now.getHours()),
      greetingDate: now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    }
  }, [])

  return (
    <>
      <h1 className="text-lg font-semibold">
        {greeting}, {name}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">{greetingDate}</p>
    </>
  )
}
