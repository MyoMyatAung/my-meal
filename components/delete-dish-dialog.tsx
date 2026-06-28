"use client"

import { useState } from "react"
import { deleteDish } from "@/app/actions/dishes"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DeleteDishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dish: { id: string; name: string } | null
  onDeleted: () => void
}

export function DeleteDishDialog({
  open,
  onOpenChange,
  dish,
  onDeleted,
}: DeleteDishDialogProps) {
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    if (!dish) return

    setPending(true)
    const result = await deleteDish(dish.id)
    setPending(false)

    if (result.success) {
      onOpenChange(false)
      onDeleted()
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Dish</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &ldquo;{dish?.name}&rdquo;? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
