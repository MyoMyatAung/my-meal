"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { swapDishAction } from "@/app/actions/plan"
import { DishPill } from "@/components/dish-pill"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface EditableDishPillProps {
  entryDishId: string
  dishId: string
  dishName: string
  isSpecial?: boolean
  options: { id: string; name: string; isSpecial: boolean }[]
  excludeIds: string[]
}

export function EditableDishPill({
  entryDishId,
  dishId,
  dishName,
  isSpecial,
  options,
  excludeIds,
}: EditableDishPillProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)

  const selectableOptions = useMemo(() => {
    const filtered = options.filter((option) => {
      return option.id === dishId || !excludeIds.includes(option.id)
    })

    if (filtered.some((option) => option.id === dishId)) {
      return filtered
    }

    return [...filtered, { id: dishId, name: dishName, isSpecial: !!isSpecial }]
  }, [dishId, dishName, excludeIds, isSpecial, options])

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <DishPill name={dishName} isSpecial={isSpecial} />
        <button
          type="button"
          aria-label="Swap dish"
          onClick={() => setEditing(true)}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Pencil className="size-3" />
        </button>
      </span>
    )
  }

  return (
    <Select
      defaultValue={dishId}
      defaultOpen
      disabled={pending}
      onValueChange={async (newDishId) => {
        if (newDishId === dishId) {
          setEditing(false)
          return
        }

        setPending(true)
        const result = await swapDishAction({ entryDishId, newDishId })
        setPending(false)
        setEditing(false)

        if (result.success) {
          router.refresh()
          return
        }

        toast.error(result.error)
      }}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setEditing(false)
        }
      }}
    >
      <SelectTrigger size="sm" className="h-7 w-auto text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {selectableOptions.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
