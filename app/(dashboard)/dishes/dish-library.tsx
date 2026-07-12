"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, StarIcon } from "lucide-react"
import { Category, MealTime } from "@prisma/client"
import { getDishes } from "@/app/actions/dishes"
import type { DishWithRelations } from "@/app/actions/dishes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DishCard } from "@/components/dish-card"
import { DishDialog } from "@/components/dish-dialog"
import { DeleteDishDialog } from "@/components/delete-dish-dialog"

const PAGE_SIZE = 12

const categoryLabels: Record<Category, string> = {
  MAIN: "Main",
  SIDE: "Side",
  SOUP: "Soup",
  SNACK: "Snack",
  ACCOMPANIMENTS: "Accompaniments",
  OTHER: "Other",
}

export function DishLibrary() {
  const [dishes, setDishes] = useState<DishWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [mealTimeFilter, setMealTimeFilter] = useState<string>("all")
  const [specialOnly, setSpecialOnly] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Pagination state
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [dishDialogOpen, setDishDialogOpen] = useState(false)
  const [editingDish, setEditingDish] = useState<DishWithRelations | null>(null)
  const [deletingDish, setDeletingDish] = useState<DishWithRelations | null>(null)

  // Debounce the search input; also reset to page 1 when the user types.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset to page 1 whenever a filter dropdown changes.
  useEffect(() => {
    setPage(1)
  }, [categoryFilter, mealTimeFilter, specialOnly])

  const fetchDishes = useCallback(async () => {
    setLoading(true)
    const filters: Record<string, string | number | boolean> = {
      page,
      pageSize: PAGE_SIZE,
    }
    if (categoryFilter !== "all") filters.category = categoryFilter
    if (mealTimeFilter !== "all") filters.mealTime = mealTimeFilter
    if (debouncedSearch) filters.search = debouncedSearch
    if (specialOnly) filters.isSpecial = true

    const result = await getDishes(filters)
    if (result.success) {
      setDishes(result.data.dishes)
      setTotal(result.data.total)
      setTotalPages(result.data.totalPages)
    }
    setLoading(false)
  }, [categoryFilter, mealTimeFilter, specialOnly, debouncedSearch, page])

  useEffect(() => {
    fetchDishes()
  }, [fetchDishes])

  function handleEdit(dish: DishWithRelations) {
    setEditingDish(dish)
    setDishDialogOpen(true)
  }

  function handleDelete(dish: DishWithRelations) {
    setDeletingDish(dish)
  }

  function handleDialogClose() {
    setDishDialogOpen(false)
    setEditingDish(null)
  }

  function handleDialogSaved() {
    fetchDishes()
  }

  function handleDeleted() {
    setDeletingDish(null)
    fetchDishes()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold">Dish Library</h1>
        <Button
          size="sm"
          onClick={() => {
            setEditingDish(null)
            setDishDialogOpen(true)
          }}
        >
          <PlusIcon />
          Add Dish
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={mealTimeFilter} onValueChange={setMealTimeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Meal Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Meals</SelectItem>
            <SelectItem value="Breakfast">Breakfast</SelectItem>
            <SelectItem value="Lunch">Lunch</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search dishes..."
          className="max-w-[200px]"
        />

        <Button
          variant={specialOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setSpecialOnly((v) => !v)}
          aria-pressed={specialOnly}
        >
          <StarIcon className={specialOnly ? "fill-current" : undefined} />
          Special
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div
              key={i}
              className="h-[180px] animate-pulse rounded-none border border-border bg-muted/50"
            />
          ))}
        </div>
      ) : dishes.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? "No dishes yet. Add your first dish to get started."
              : "No dishes match your current filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dishes.map((dish) => (
            <DishCard
              key={dish.id}
              dish={dish}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination bar — only shown when there are dishes and more than one page */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} &mdash; {total} dish{total !== 1 ? "es" : ""}
          </p>
          <div className="flex items-center gap-1">
            <Button
              id="dishes-prev-page"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              id="dishes-next-page"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <DishDialog
        open={dishDialogOpen}
        onOpenChange={handleDialogClose}
        dish={editingDish}
        onSaved={handleDialogSaved}
      />

      <DeleteDishDialog
        open={!!deletingDish}
        onOpenChange={(open) => {
          if (!open) setDeletingDish(null)
        }}
        dish={deletingDish}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
