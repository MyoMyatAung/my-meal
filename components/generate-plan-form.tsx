"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { generatePlanAction } from "@/app/actions/plan"
import {
  addDaysToCalendarDate,
  formatCalendarDate,
  parseCalendarDate,
} from "@/lib/utils/date"
import { ArrowLeft, Loader2 } from "lucide-react"

function getTodayStr(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, "0")
  const d = String(now.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function GeneratePlanForm() {
  const router = useRouter()
  const [startDate, setStartDate] = useState(getTodayStr)
  const [durationValue, setDurationValue] = useState(2)
  const [durationUnit, setDurationUnit] = useState<"Weeks" | "Days">("Weeks")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const durationDays = durationUnit === "Weeks" ? durationValue * 7 : durationValue
  const endDateStr = addDaysToCalendarDate(startDate, durationDays - 1)
  const previewText = `This plan runs ${formatCalendarDate(parseCalendarDate(startDate), { month: "short", day: "numeric" })} to ${formatCalendarDate(parseCalendarDate(endDateStr), { month: "short", day: "numeric" })}.`

  async function handleGenerate() {
    setIsGenerating(true)
    setError(null)

    const result = await generatePlanAction({ startDate, durationDays })

    if (result.success) {
      router.refresh()
    } else {
      setError(result.error)
      setIsGenerating(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Dashboard
      </button>

      <h1 className="mb-2 text-lg font-semibold">Generate plan</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        These settings control this plan and how future plans are scheduled.
      </p>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Start date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={getTodayStr()}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Duration</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={durationValue}
                onChange={(e) => setDurationValue(Number(e.target.value))}
                min={1}
                max={durationUnit === "Weeks" ? 52 : 365}
                className="w-20"
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={durationUnit === "Weeks" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDurationUnit("Weeks")}
                >
                  Weeks
                </Button>
                <Button
                  type="button"
                  variant={durationUnit === "Days" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDurationUnit("Days")}
                >
                  Days
                </Button>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Default: 2 weeks (14 days)
            </p>
          </div>

          <p className="text-sm text-muted-foreground">{previewText}</p>
        </CardContent>
      </Card>

      {error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push("/")}
          disabled={isGenerating}
        >
          Cancel
        </Button>
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating && <Loader2 className="mr-2 size-4 animate-spin" />}
          Generate plan
        </Button>
      </div>
    </div>
  )
}
