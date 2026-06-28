"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark" | "system"
type ResolvedTheme = "light" | "dark"

const THEMES: Theme[] = ["light", "dark", "system"]

function isValidTheme(value: string): value is Theme {
  return THEMES.includes(value as Theme)
}

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read initial state from localStorage safely during initialization to handle ssr
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system"
    const stored = localStorage.getItem("theme")
    return stored && isValidTheme(stored) ? stored : "system"
  })

  const [resolvedTheme, setResolved] = useState<ResolvedTheme>(() => {
    if (typeof window === "undefined") return "light"
    const stored = localStorage.getItem("theme")
    const initial = stored && isValidTheme(stored) ? stored : "system"
    if (initial === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    return initial
  })

  // Apply theme class on mount to ensure synchronization
  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      setResolved(getSystemTheme())
      applyTheme(getSystemTheme())
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    localStorage.setItem("theme", next)
    const resolved = next === "system" ? getSystemTheme() : next
    setResolved(resolved)
    applyTheme(resolved)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
