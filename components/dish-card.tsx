"use client"

import { PencilIcon, TrashIcon, StarIcon } from "lucide-react"
import type { DishWithRelations } from "@/app/actions/dishes"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CategoryBadge } from "@/components/category-badge"
import { FlavorTag } from "@/components/flavor-tag"

interface DishCardProps {
  dish: DishWithRelations
  onEdit: (dish: DishWithRelations) => void
  onDelete: (dish: DishWithRelations) => void
}

export function DishCard({ dish, onEdit, onDelete }: DishCardProps) {
  const maxFlavors = 3
  const visibleFlavors = dish.flavors.slice(0, maxFlavors)
  const extraCount = dish.flavors.length - maxFlavors

  return (
    <Card className="group">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between">
          <CategoryBadge category={dish.category} />
          {dish.isSpecial && (
            <StarIcon className="size-4 fill-current text-foreground" />
          )}
        </div>

        <h3 className="truncate text-sm font-medium">{dish.name}</h3>

        <p className="text-xs text-muted-foreground">
          {dish.mealTime} · {dish.ingredients.length} ingredient
          {dish.ingredients.length !== 1 ? "s" : ""}
        </p>

        {dish.flavors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleFlavors.map((f) => (
              <FlavorTag key={f.id} flavor={f.flavor.name} />
            ))}
            {extraCount > 0 && (
              <span className="text-xs text-muted-foreground">
                +{extraCount} more
              </span>
            )}
          </div>
        )}

        {dish.pairedDishes.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            Paired with: {dish.pairedDishes.map((d) => d.name).join(", ")}
          </p>
        )}

        <div className="flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => onEdit(dish)}
          >
            <PencilIcon />
            Edit
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => onDelete(dish)}
          >
            <TrashIcon />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
