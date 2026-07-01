"use client"

import { useState } from "react"
import { toast } from "sonner"
import { toggleShoppingItemAction } from "@/app/actions/shopping-list"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

interface ShoppingListViewProps {
  planId: string
  items: { id: string; isChecked: boolean; ingredient: { id: string; name: string } }[]
}

export function ShoppingListView({ items: initialItems }: ShoppingListViewProps) {
  const [items, setItems] = useState(initialItems)

  const checkedCount = items.filter((item) => item.isChecked).length

  async function handleToggle(itemId: string, isChecked: boolean) {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, isChecked } : item))
    )

    const result = await toggleShoppingItemAction({ itemId, isChecked })
    if (!result.success) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, isChecked: !isChecked } : item
        )
      )
      toast.error(result.error)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Shopping list</h1>
        <span className="text-xs text-muted-foreground">
          {checkedCount} of {items.length} checked
        </span>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-3 p-3 text-sm">
              <Checkbox
                checked={item.isChecked}
                onCheckedChange={(checked) => handleToggle(item.id, checked === true)}
              />
              <span className={item.isChecked ? "line-through text-muted-foreground" : ""}>
                {item.ingredient.name}
              </span>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
