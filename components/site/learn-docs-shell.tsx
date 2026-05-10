"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu } from "lucide-react"

import type { LearnNavItem } from "@/lib/learn/nav"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * Renders one level of the learn navigation tree (recursive for nested items).
 */
function LearnNavList({
  items,
  onNavigate,
}: {
  items: LearnNavItem[]
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href
        const childActive = item.children?.some((c) => c.href === pathname)
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={() => onNavigate?.()}
              className={cn(
                "block rounded-md px-2 py-1.5 text-sm transition-colors",
                active || childActive
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {item.title}
            </Link>
            {item.children?.length ? (
              <div className="mt-1 border-l border-border/60 pl-3">
                <LearnNavList items={item.children} onNavigate={onNavigate} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Documentation-style shell: desktop sidebar plus mobile sheet (React Flow Learn–style).
 */
export function LearnDocsShell({
  nav,
  children,
}: {
  nav: LearnNavItem[]
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 md:flex-row md:gap-8 md:px-6">
      {/* Mobile menu */}
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button type="button" variant="outline" size="sm" className="gap-2">
                <Menu className="size-4" aria-hidden />
                Menu
              </Button>
            }
          />
          <SheetContent side="left" className="w-[min(100vw-2rem,320px)]">
            <SheetHeader>
              <SheetTitle>Learn</SheetTitle>
            </SheetHeader>
            <ScrollArea className="mt-4 h-[calc(100dvh-6rem)] pr-3">
              <LearnNavList items={nav} onNavigate={() => setMobileOpen(false)} />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Sidebar — desktop */}
      <aside className="hidden w-56 shrink-0 md:block">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">Learn</p>
        <ScrollArea className="h-[calc(100dvh-8rem)] pr-3">
          <LearnNavList items={nav} />
        </ScrollArea>
      </aside>

      {/* Main article column */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
