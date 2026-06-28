"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { XIcon, SettingsIcon } from "lucide-react"
import { getIngredients } from "@/app/actions/ingredients"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { IngredientSheet } from "@/components/ingredient-sheet"

interface IngredientComboboxProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

interface Ingredient {
  id: string
  name: string
  userId: string
}

export function IngredientCombobox({
  selectedIds,
  onChange,
}: IngredientComboboxProps) {
  const [open, setOpen] = useState(false)
  // Search-filtered results shown in the dropdown
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Accumulates every ingredient ever fetched so selected badges
  // are always resolved from the full known set, not the filtered subset.
  const allIngredientsRef = useRef<Map<string, Ingredient>>(new Map())

  const fetchIngredients = useCallback(async (q?: string) => {
    const result = await getIngredients(q)
    if (result.success) {
      const fetched: Ingredient[] = result.data.ingredients
      // Merge into the cumulative cache
      fetched.forEach((ing) => allIngredientsRef.current.set(ing.id, ing))
      setIngredients(fetched)
    }
  }, [])

  useEffect(() => {
    fetchIngredients(search || undefined)
  }, [search, fetchIngredients])

  // Derive selected badges from the full cache — unaffected by search query
  const selectedIngredients = useMemo(
    () =>
      selectedIds
        .map((id) => allIngredientsRef.current.get(id))
        .filter((i): i is Ingredient => i !== undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIds, ingredients], // re-run whenever the cache is updated (ingredients change)
  )

  const availableIngredients = ingredients.filter(
    (i) => !selectedIds.includes(i.id),
  )

  function toggleIngredient(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  function removeIngredient(id: string) {
    onChange(selectedIds.filter((i) => i !== id))
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {selectedIngredients.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedIngredients.map((ingredient) => (
              <Badge
                key={ingredient.id}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {ingredient.name}
                <button
                  type="button"
                  onClick={() => removeIngredient(ingredient.id)}
                  className="ml-0.5 rounded-none p-0.5 hover:bg-muted"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
              variant="outline"
              size="sm"
              className="w-full justify-start text-muted-foreground"
            >
              Search ingredients...
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search ingredients..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>No ingredients found.</CommandEmpty>
                <CommandGroup>
                  {availableIngredients.map((ingredient) => (
                    <CommandItem
                      key={ingredient.id}
                      value={ingredient.id}
                      onSelect={() => toggleIngredient(ingredient.id)}
                    >
                      {ingredient.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup>
                  <CommandItem
                    value="__manage__"
                    onSelect={() => {
                      setOpen(false)
                      setSheetOpen(true)
                    }}
                  >
                    <SettingsIcon className="size-4" />
                    Manage Ingredients
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <IngredientSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onChange={() => fetchIngredients(search || undefined)}
      />
    </>
  )
}
