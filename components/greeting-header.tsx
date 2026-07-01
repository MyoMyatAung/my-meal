"use client"

import { useEffect, useState } from "react"

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function getTimeDependentValues() {
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
}

export function GreetingHeader({ name }: { name?: string | null }) {
  const [timeValues, setTimeValues] = useState<{
    greeting: string
    greetingDate: string
  } | null>(null)

  useEffect(() => {
    setTimeValues(getTimeDependentValues())
  }, [])

  return (
    <>
      <h1 className="text-lg font-semibold">
        {timeValues?.greeting ?? "\u00A0"}, {name}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {timeValues?.greetingDate ?? "\u00A0"}
      </p>
    </>
  )
}
