"use client"

import { useState, useEffect } from "react"
import { Category, MealTime } from "@prisma/client"
import { DishSchema } from "@/lib/zod/dish"
import { createDish, updateDish } from "@/app/actions/dishes"
import type { DishWithRelations } from "@/app/actions/dishes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FlavorCombobox } from "@/components/flavor-combobox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IngredientCombobox } from "@/components/ingredient-combobox"
import { DishPairingCombobox } from "@/components/dish-pairing-combobox"

interface DishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dish?: DishWithRelations | null
  onSaved: () => void
}

const categoryLabels: Record<Category, string> = {
  MAIN: "Main",
  SIDE: "Side",
  SOUP: "Soup",
  SNACK: "Snack",
  ACCOMPANIMENTS: "Accompaniments",
  OTHER: "Other",
}

export function DishDialog({
  open,
  onOpenChange,
  dish,
  onSaved,
}: DishDialogProps) {
  const isEdit = !!dish

  const [name, setName] = useState("")
  const [category, setCategory] = useState<Category>(Category.MAIN)
  const [mealTime, setMealTime] = useState<MealTime>(MealTime.Lunch)
  const [isSpecial, setIsSpecial] = useState(false)
  const [flavors, setFlavors] = useState<string[]>([])
  const [ingredientIds, setIngredientIds] = useState<string[]>([])
  const [pairedDishIds, setPairedDishIds] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      if (dish) {
        setName(dish.name)
        setCategory(dish.category)
        setMealTime(dish.mealTime)
        setIsSpecial(dish.isSpecial)
        setFlavors(dish.flavors.map((f) => f.flavor.name))
        setIngredientIds(dish.ingredients.map((i) => i.ingredient.id))
        setPairedDishIds(dish.pairedDishes.map((d) => d.id))
      } else {
        setName("")
        setCategory(Category.MAIN)
        setMealTime(MealTime.Lunch)
        setIsSpecial(false)
        setFlavors([])
        setIngredientIds([])
        setPairedDishIds([])
      }
      setErrors({})
    }
  }, [open, dish])

  useEffect(() => {
    if (mealTime === MealTime.Breakfast && isSpecial) {
      setIsSpecial(false)
    }
  }, [mealTime, isSpecial])

  useEffect(() => {
    if (mealTime === MealTime.Breakfast && pairedDishIds.length > 0) {
      setPairedDishIds([])
    }
  }, [mealTime, pairedDishIds])

  async function handleSubmit() {
    const parsed = DishSchema.safeParse({
      name,
      category,
      mealTime,
      isSpecial,
      flavors,
      ingredientIds,
      pairedDishIds,
    })

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const [key, value] of Object.entries(
        parsed.error.flatten().fieldErrors,
      )) {
        if (value?.[0]) fieldErrors[key] = value[0]
      }
      setErrors(fieldErrors)
      return
    }

    setErrors({})
    setPending(true)

    try {
      const result = isEdit
        ? await updateDish(dish.id, parsed.data)
        : await createDish(parsed.data)

      if (result.success) {
        onOpenChange(false)
        onSaved()
      } else {
        setErrors({ form: result.error })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Dish" : "Create Dish"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {errors.form && (
            <p className="text-xs text-destructive">{errors.form}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Dish name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spaghetti Bolognese"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Category</label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as Category)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs text-destructive">{errors.category}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Meal Time</label>
              <div className="flex items-center gap-3 h-8">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="radio"
                    name="mealTime"
                    value="Breakfast"
                    checked={mealTime === MealTime.Breakfast}
                    onChange={() => setMealTime(MealTime.Breakfast)}
                    className="accent-current"
                  />
                  Breakfast
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="radio"
                    name="mealTime"
                    value="Lunch"
                    checked={mealTime === MealTime.Lunch}
                    onChange={() => setMealTime(MealTime.Lunch)}
                    className="accent-current"
                  />
                  Lunch
                </label>
              </div>
              {errors.mealTime && (
                <p className="text-xs text-destructive">{errors.mealTime}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isSpecial"
              checked={isSpecial}
              onChange={(e) => setIsSpecial(e.target.checked)}
              disabled={mealTime === MealTime.Breakfast}
              className="accent-current"
            />
            <label
              htmlFor="isSpecial"
              className={`text-xs ${mealTime === MealTime.Breakfast ? "text-muted-foreground" : ""}`}
            >
              Special dish
              {mealTime === MealTime.Breakfast && " (Lunch only)"}
            </label>
            {errors.isSpecial && (
              <p className="text-xs text-destructive">{errors.isSpecial}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Flavors</label>
            <FlavorCombobox flavors={flavors} onChange={setFlavors} />
            {errors.flavors && (
              <p className="text-xs text-destructive">{errors.flavors}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Ingredients</label>
            <IngredientCombobox
              selectedIds={ingredientIds}
              onChange={setIngredientIds}
            />
            {errors.ingredientIds && (
              <p className="text-xs text-destructive">
                {errors.ingredientIds}
              </p>
            )}
          </div>

          {mealTime === MealTime.Lunch && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">
                Paired with (Lunch dishes)
              </label>
              <DishPairingCombobox
                selectedIds={pairedDishIds}
                onChange={setPairedDishIds}
                excludeDishId={dish?.id}
              />
              {errors.pairedDishIds && (
                <p className="text-xs text-destructive">
                  {errors.pairedDishIds}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
