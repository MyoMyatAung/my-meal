"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { XIcon } from "lucide-react"
import { getDishes } from "@/app/actions/dishes"
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

interface DishPairingComboboxProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  excludeDishId?: string
}

interface PairableDish {
  id: string
  name: string
}

export function DishPairingCombobox({
  selectedIds,
  onChange,
  excludeDishId,
}: DishPairingComboboxProps) {
  const [open, setOpen] = useState(false)
  // Search-filtered results shown in the dropdown
  const [dishes, setDishes] = useState<PairableDish[]>([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  // Accumulates every dish ever fetched so selected badges are always
  // resolved from the full known set, not the search-filtered subset.
  const allDishesRef = useRef<Map<string, PairableDish>>(new Map())

  const fetchDishes = useCallback(
    async (q?: string) => {
      const result = await getDishes({
        mealTime: "Lunch",
        search: q,
        pageSize: 50,
      })
      if (result.success) {
        const fetched: PairableDish[] = result.data.dishes
          .filter((d) => d.id !== excludeDishId)
          .map((d) => ({ id: d.id, name: d.name }))
        fetched.forEach((d) => allDishesRef.current.set(d.id, d))
        setDishes(fetched)
      }
    },
    [excludeDishId]
  )

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetchDishes(debouncedSearch || undefined)
  }, [debouncedSearch, fetchDishes])

  // Derive selected badges from the full cache — unaffected by search query
  const selectedDishes = useMemo(
    () =>
      selectedIds
        .map((id) => allDishesRef.current.get(id))
        .filter((d): d is PairableDish => d !== undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIds, dishes]
  )

  const availableDishes = dishes.filter((d) => !selectedIds.includes(d.id))

  function toggleDish(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  function removeDish(id: string) {
    onChange(selectedIds.filter((i) => i !== id))
  }

  return (
    <div className="flex flex-col gap-1.5">
      {selectedDishes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedDishes.map((dish) => (
            <Badge key={dish.id} variant="secondary" className="gap-1 pr-1">
              {dish.name}
              <button
                type="button"
                onClick={() => removeDish(dish.id)}
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
            variant="outline"
            size="sm"
            className="w-full justify-start text-muted-foreground"
          >
            Search Lunch dishes...
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search Lunch dishes..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No dishes found.</CommandEmpty>
              <CommandGroup>
                {availableDishes.map((dish) => (
                  <CommandItem
                    key={dish.id}
                    value={dish.id}
                    onSelect={() => toggleDish(dish.id)}
                  >
                    {dish.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
