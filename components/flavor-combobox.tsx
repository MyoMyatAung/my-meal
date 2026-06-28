"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { XIcon, PlusIcon } from "lucide-react"
import { getFlavors } from "@/app/actions/dishes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface FlavorComboboxProps {
  /** Currently selected flavor strings (free-text names). */
  flavors: string[]
  onChange: (flavors: string[]) => void
}

interface Flavor {
  id: string
  name: string
}

export function FlavorCombobox({ flavors, onChange }: FlavorComboboxProps) {
  const [input, setInput] = useState("")
  const [suggestions, setSuggestions] = useState<Flavor[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchSuggestions = useCallback(async (query: string) => {
    const result = await getFlavors(query || undefined)
    if (result.success) {
      // Exclude flavors already added (case-insensitive)
      const addedLower = new Set(flavors.map((f) => f.toLowerCase()))
      setSuggestions(
        result.data.flavors.filter((f) => !addedLower.has(f.name.toLowerCase())),
      )
    }
  }, [flavors])

  useEffect(() => {
    if (open) {
      fetchSuggestions(input)
    }
  }, [input, open, fetchSuggestions])

  /** Normalize and add a flavor string (from typing or selection). */
  function addFlavor(name: string) {
    const trimmed = name.trim()
    if (!trimmed || flavors.length >= 10) return

    const lower = trimmed.toLowerCase()
    if (flavors.some((f) => f.toLowerCase() === lower)) {
      // Already added — just clear the input without error
      setInput("")
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    onChange([...flavors, trimmed])
    setInput("")
    setOpen(false)
    setActiveIndex(-1)
    // Keep focus on input for rapid entry
    inputRef.current?.focus()
  }

  function removeFlavor(flavor: string) {
    onChange(flavors.filter((f) => f !== flavor))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        // Select highlighted suggestion
        addFlavor(suggestions[activeIndex].name)
      } else {
        // Add whatever is typed
        addFlavor(input)
      }
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
      return
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
      return
    }

    if (e.key === "Escape") {
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    if (e.key === "Backspace" && input === "" && flavors.length > 0) {
      // Remove last chip on Backspace when input is empty
      removeFlavor(flavors[flavors.length - 1])
    }
  }

  // Close the dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Reset activeIndex when suggestions change
  useEffect(() => {
    setActiveIndex(-1)
  }, [suggestions])

  const showDropdown = open && (suggestions.length > 0 || input.trim().length > 0)

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      {/* Selected flavor chips */}
      {flavors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {flavors.map((f) => (
            <Badge key={f} variant="secondary" className="gap-1 pr-1">
              {f}
              <button
                type="button"
                onClick={() => removeFlavor(f)}
                className="ml-0.5 rounded-none p-0.5 hover:bg-muted"
                aria-label={`Remove ${f}`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input + Add button row */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={
              flavors.length >= 10 ? "Max 10 flavors reached" : "Type a flavor..."
            }
            disabled={flavors.length >= 10}
            autoComplete="off"
          />

          {/* Suggestions dropdown */}
          {showDropdown && (
            <ul
              ref={listRef}
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-none border border-border bg-popover shadow-md"
            >
              {suggestions.length === 0 && input.trim() ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">
                  Press Enter or click Add to create &quot;{input.trim()}&quot;
                </li>
              ) : (
                suggestions.map((s, idx) => (
                  <li
                    key={s.id}
                    role="option"
                    aria-selected={idx === activeIndex}
                    onMouseDown={(e) => {
                      // Prevent blur before selection
                      e.preventDefault()
                      addFlavor(s.name)
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`cursor-pointer px-3 py-2 text-sm ${
                      idx === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {s.name}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => addFlavor(input)}
          disabled={!input.trim() || flavors.length >= 10}
          aria-label="Add flavor"
        >
          <PlusIcon className="size-4" />
          Add
        </Button>
      </div>
    </div>
  )
}
