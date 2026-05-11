"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ChevronDown, ChevronRight, Menu } from "lucide-react"

import { collectLearnNavExpandedHrefsForPathname, type LearnNavItem } from "@/lib/learn/nav"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * True when `pathname` matches this item or any nested child href.
 */
function learnNavSubtreeContainsPathname({
  item,
  pathname,
}: {
  item: LearnNavItem
  pathname: string
}): boolean {
  if (pathname === item.href) {
    return true
  }
  if (!item.children?.length) {
    return false
  }
  return item.children.some((child) => learnNavSubtreeContainsPathname({ item: child, pathname }))
}

/**
 * Renders one level of the learn navigation tree with collapsible branches.
 *
 * @param expandedHrefs Branch {@link LearnNavItem.href} values that are expanded.
 * @param onBranchOpenChange Called when a branch is expanded or collapsed.
 */
/**
 * Stable list key when multiple items share one href (e.g. Code group + Run code child).
 */
function learnNavItemListKey({ item }: { item: LearnNavItem }): string {
  return `${item.href}\u0001${item.title}`
}

function LearnNavList({
  items,
  expandedHrefs,
  onBranchOpenChange,
  onNavigate,
}: {
  items: LearnNavItem[]
  expandedHrefs: Set<string>
  onBranchOpenChange: ({ href, open }: { href: string; open: boolean }) => void
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href
        const childActive =
          item.children?.some((child) => learnNavSubtreeContainsPathname({ item: child, pathname })) ?? false
        const branchOpen = expandedHrefs.has(item.href)
        const linkClass = cn(
          "block min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm transition-colors",
          active || childActive
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )

        // Leaf link only
        if (!item.children?.length) {
          return (
            <li key={learnNavItemListKey({ item })}>
              <Link href={item.href} onClick={() => onNavigate?.()} className={linkClass}>
                {item.title}
              </Link>
            </li>
          )
        }

        // Branch: chevron toggles children; title still navigates
        return (
          <li key={learnNavItemListKey({ item })}>
            <Collapsible
              open={branchOpen}
              onOpenChange={(open) => onBranchOpenChange({ href: item.href, open })}
            >
              {/* Row: disclosure + page link */}
              <div className="flex items-stretch gap-0.5">
                <CollapsibleTrigger
                  type="button"
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-md px-1 text-muted-foreground transition-colors",
                    "hover:bg-muted/60 hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                  aria-label={branchOpen ? `Collapse ${item.title}` : `Expand ${item.title}`}
                >
                  {branchOpen ? (
                    <ChevronDown className="size-4" aria-hidden />
                  ) : (
                    <ChevronRight className="size-4" aria-hidden />
                  )}
                </CollapsibleTrigger>
                <Link href={item.href} onClick={() => onNavigate?.()} className={linkClass}>
                  {item.title}
                </Link>
              </div>
              {/* Nested pages */}
              <CollapsibleContent>
                <div className="mt-1 border-l border-border/60 pl-3">
                  <LearnNavList
                    items={item.children}
                    expandedHrefs={expandedHrefs}
                    onBranchOpenChange={onBranchOpenChange}
                    onNavigate={onNavigate}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
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
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedHrefs, setExpandedHrefs] = useState(() =>
    collectLearnNavExpandedHrefsForPathname({ items: nav, pathname }),
  )
  const [pathnameForExpanded, setPathnameForExpanded] = useState(pathname)

  /**
   * When the route changes, reset open branches to the active path only (no effect — avoids a render cascade lint).
   */
  if (pathname !== pathnameForExpanded) {
    setPathnameForExpanded(pathname)
    setExpandedHrefs(collectLearnNavExpandedHrefsForPathname({ items: nav, pathname }))
  }

  /**
   * Updates which branch nodes are expanded in the learn nav tree.
   */
  function handleBranchOpenChange({ href, open }: { href: string; open: boolean }) {
    setExpandedHrefs((prev) => {
      const next = new Set(prev)
      if (open) {
        next.add(href)
      } else {
        next.delete(href)
      }
      return next
    })
  }

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
              <LearnNavList
                items={nav}
                expandedHrefs={expandedHrefs}
                onBranchOpenChange={handleBranchOpenChange}
                onNavigate={() => setMobileOpen(false)}
              />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Sidebar: desktop */}
      <aside className="hidden w-56 shrink-0 self-start md:block">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">Learn</p>
        <nav className="pr-1" aria-label="Learn documentation">
          <LearnNavList
            items={nav}
            expandedHrefs={expandedHrefs}
            onBranchOpenChange={handleBranchOpenChange}
          />
        </nav>
      </aside>

      {/* Main article column */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
