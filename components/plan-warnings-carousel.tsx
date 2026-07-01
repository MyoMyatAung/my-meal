"use client"

import { useState } from "react"
import { TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCalendarDate } from "@/lib/utils/date"
import type { WarningCard } from "@/lib/utils/warning-cards"

const VISIBLE_LIMIT = 4

function WarningCardItem({ warning }: { warning: WarningCard }) {
  return (
    <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <div>
        <p>{warning.message}</p>
        {warning.dates.length > 0 && (
          <p className="mt-1 text-xs opacity-80">
            {warning.dates
              .map((dateStr) =>
                formatCalendarDate(new Date(`${dateStr}T00:00:00.000Z`), {
                  month: "short",
                  day: "numeric",
                })
              )
              .join(", ")}
          </p>
        )}
      </div>
    </div>
  )
}

export function PlanWarningsCarousel({ warnings }: { warnings: WarningCard[] }) {
  const [showAll, setShowAll] = useState(false)

  if (warnings.length === 0) return null

  const visibleWarnings = warnings.slice(0, VISIBLE_LIMIT)
  const hiddenCount = warnings.length - visibleWarnings.length

  return (
    <div className="mb-6 w-full">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visibleWarnings.map((warning) => (
          <WarningCardItem key={warning.id} warning={warning} />
        ))}
      </div>

      {hiddenCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => setShowAll(true)}
        >
          Show More ({hiddenCount} more)
        </Button>
      )}

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>All Warnings ({warnings.length})</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {warnings.map((warning) => (
              <WarningCardItem key={warning.id} warning={warning} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
