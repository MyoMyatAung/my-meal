"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { useTheme } from "@/components/theme-provider"
import {
  LayoutDashboard,
  CalendarDays,
  Utensils,
  ShoppingCart,
  History,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Plan", href: "/plan", icon: CalendarDays },
  { label: "Dishes", href: "/dishes", icon: Utensils },
  { label: "Shopping list", href: "/shopping-list", icon: ShoppingCart },
  { label: "History", href: "/history", icon: History },
]

interface SidebarProps {
  user: {
    name?: string | null
    email?: string | null
  }
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  useEffect(() => {
    closeMobile()
  }, [pathname, closeMobile])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobile()
    }
    if (mobileOpen) {
      document.addEventListener("keydown", onKeyDown)
      return () => document.removeEventListener("keydown", onKeyDown)
    }
  }, [mobileOpen, closeMobile])

  const isDarkTheme = resolvedTheme === "dark"

  const initial = user.name?.charAt(0)?.toUpperCase() ?? user.email?.charAt(0)?.toUpperCase() ?? "?"

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-3 md:hidden">
        <span className="text-sm font-semibold text-sidebar-foreground">
          My Meal
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </Button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-49 bg-black/50 md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 z-40 flex w-54 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200",
          "max-md:top-0 max-md:bottom-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-5">
          <span className="text-sm font-semibold">My Meal</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="md:hidden"
            onClick={closeMobile}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 border-l-2 px-2.5 py-2 text-xs font-medium text-sidebar-foreground transition-colors",
                  isActive
                    ? "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
                    : "border-transparent hover:bg-surface-hover hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        <hr className="mx-4 border-sidebar-border" />

        {/* Footer */}
        <div className="flex flex-col gap-2 px-4 py-5">
          <button
            onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
            className="flex items-center gap-2 rounded-none border border-input bg-surface-input px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-surface-hover"
          >
            {isDarkTheme ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
            {isDarkTheme ? "Light mode" : "Dark mode"}
          </button>

          <div className="flex items-center gap-2.5 px-1 py-1">
            <div className="flex size-6 shrink-0 items-center justify-center bg-primary text-primary-foreground text-xs font-semibold">
              {initial}
            </div>
            <span className="truncate text-xs font-medium">
              {user.name ?? user.email}
            </span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
            className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
