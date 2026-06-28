"use client"

import { useState, useEffect, useCallback } from "react"
import { PencilIcon, TrashIcon, CheckIcon, XIcon, SearchIcon } from "lucide-react"
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} from "@/app/actions/ingredients"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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

interface IngredientSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange?: () => void
}

interface Ingredient {
  id: string
  name: string
  userId: string
}

export function IngredientSheet({
  open,
  onOpenChange,
  onChange,
}: IngredientSheetProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [newName, setNewName] = useState("")
  const [addNote, setAddNote] = useState<string | null>(null)
  const [addPending, setAddPending] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Ingredient | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const filtered = ingredients.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  )

  const fetchIngredients = useCallback(async () => {
    const result = await getIngredients()
    if (result.success) {
      setIngredients(result.data.ingredients)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchIngredients()
      setSearch("")
    }
  }, [open, fetchIngredients])

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) return

    setAddPending(true)
    setAddNote(null)

    const result = await createIngredient({ name: trimmed })
    if (result.success) {
      if (result.data.reused) {
        setAddNote("Already in your list")
      }
      setNewName("")
      await fetchIngredients()
      onChange?.()
    } else {
      setAddNote(result.error)
    }
    setAddPending(false)
  }

  function startEdit(ingredient: Ingredient) {
    setEditingId(ingredient.id)
    setEditingName(ingredient.name)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingName("")
    setEditError(null)
  }

  async function saveEdit(id: string) {
    const trimmed = editingName.trim()
    if (!trimmed) return

    const result = await updateIngredient(id, { name: trimmed })
    if (result.success) {
      setEditingId(null)
      setEditingName("")
      setEditError(null)
      await fetchIngredients()
      onChange?.()
    } else {
      setEditError(result.error)
    }
  }

  async function confirmDelete() {
    if (!deleting) return

    const result = await deleteIngredient(deleting.id)
    if (result.success) {
      setDeleting(null)
      setDeleteError(null)
      await fetchIngredients()
      onChange?.()
    } else {
      setDeleteError(result.error)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Manage Ingredients</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                setAddNote(null)
              }}
              placeholder="Add ingredient..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAdd()
                }
              }}
              disabled={addPending}
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={addPending || !newName.trim()}
            >
              Add
            </Button>
          </div>

          {addNote && (
            <p className="text-xs text-muted-foreground">{addNote}</p>
          )}

          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ingredients..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {ingredients.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No ingredients yet. Add your first ingredient above.
              </p>
            )}

            {ingredients.length > 0 && filtered.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No ingredients match your search.
              </p>
            )}

            {filtered.map((ingredient) => (
              <div
                key={ingredient.id}
                className="group flex items-center gap-2 rounded-none border border-transparent px-2 py-1.5 hover:border-border"
              >
                {editingId === ingredient.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => {
                        setEditingName(e.target.value)
                        setEditError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          saveEdit(ingredient.id)
                        }
                        if (e.key === "Escape") cancelEdit()
                      }}
                      className="h-7 flex-1"
                      autoFocus
                    />
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => saveEdit(ingredient.id)}
                    >
                      <CheckIcon />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={cancelEdit}
                    >
                      <XIcon />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-xs">
                      {ingredient.name}
                    </span>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => startEdit(ingredient)}
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => {
                        setDeleting(ingredient)
                        setDeleteError(null)
                      }}
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <TrashIcon />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          {editError && (
            <p className="text-xs text-destructive">{editError}</p>
          )}
        </div>
      </SheetContent>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ingredient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleting?.name}&rdquo;?
              {deleteError && (
                <span className="mt-2 block text-destructive">
                  {deleteError}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
