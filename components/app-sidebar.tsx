"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity, ArrowLeft, ChevronRight, Clock, Command, GitBranch,
  Search, Settings, Webhook, Workflow, Zap,
  BarChart3, Book, HelpCircle, Plus
} from "lucide-react"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { NavUser } from "@/components/nav-user"
import type { WorkflowListRow } from "@/lib/workflows/queries"

interface User {
  name: string
  email: string
  avatar?: string
}

interface SubNavItem {
  id: string
  title: string
  url: string
  icon?: React.ReactNode
  description?: string
  badge?: string | number
}

interface NavItem {
  id: string
  title: string
  url?: string
  icon: React.ReactNode
  badge?: string | number
  subItems?: SubNavItem[]
  backLabel?: string
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
}
const transition = { type: "spring" as const, stiffness: 350, damping: 32 }

const navItems: NavItem[] = [
  {
    id: "workflows",
    title: "Workflows",
    url: "/workflows",
    icon: <Workflow className="size-4" />,
  },
  {
    id: "runs",
    title: "Runs",
    url: "/run",
    icon: <Activity className="size-4" />,
  },
  {
    id: "triggers",
    title: "Triggers",
    icon: <Zap className="size-4" />,
    backLabel: "Navigation",
    subItems: [
      { id: "manual", title: "Manual triggers", url: "/triggers/manual", icon: <Command className="size-4" /> },
      { id: "webhooks", title: "Webhooks", url: "/triggers/webhooks", icon: <Webhook className="size-4" /> },
      { id: "schedules", title: "Schedules", url: "/triggers/schedules", icon: <Clock className="size-4" /> },
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    url: "/analytics",
    icon: <BarChart3 className="size-4" />,
  },
  {
    id: "settings",
    title: "Settings",
    icon: <Settings className="size-4" />,
    backLabel: "Navigation",
    subItems: [
      { id: "profile", title: "Profile", url: "/settings/profile", icon: <Settings className="size-4" /> },
      { id: "integrations", title: "Integrations", url: "/settings/integrations", icon: <GitBranch className="size-4" /> },
      { id: "docs", title: "Documentation", url: "https://docs.runneroo.io", icon: <Book className="size-4" /> },
      { id: "help", title: "Help & Support", url: "/help", icon: <HelpCircle className="size-4" /> },
    ],
  },
]

/**
 * Primary app navigation with optional recent workflows under the composer entry point.
 */
export function AppSidebar({
  user,
  recentWorkflows,
}: {
  user: User
  recentWorkflows: WorkflowListRow[]
}) {
  const [panelStack, setPanelStack] = React.useState<string[]>(["root"])
  const [direction, setDirection] = React.useState(1)
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const activePanel = panelStack[panelStack.length - 1]

  function drillDown(itemId: string) {
    setDirection(1)
    setPanelStack((prev) => [...prev, itemId])
  }

  function goBack() {
    setDirection(-1)
    setPanelStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }

  function closeSearch() {
    setIsSearchOpen(false)
    setSearchQuery("")
  }

  function clearSearch() {
    setSearchQuery("")
    searchInputRef.current?.focus()
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setIsSearchOpen((o) => !o)
      }
      if (e.key === "Escape") closeSearch()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  React.useEffect(() => {
    if (isSearchOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })
    }
  }, [isSearchOpen])

  const activeNavItem = navItems.find((i) => i.id === activePanel)

  function renderPanel(panelId: string) {
    if (panelId === "root") {
      return (
        <div className="flex flex-col gap-1 p-2">
          {/* Search trigger */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full text-left mb-1"
          >
            <Search className="size-3.5 shrink-0" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="pointer-events-none hidden h-4 select-none items-center rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground sm:flex">
              ⌘K
            </kbd>
          </button>

          {/* New Workflow */}
          <Link
            href="/workflows/new"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors mb-2"
          >
            <Plus className="size-3.5 shrink-0" />
            New workflow
          </Link>

          {/* Recent workflows */}
          {recentWorkflows.length > 0 && (
            <div className="mb-3 space-y-0.5">
              <p className="text-[10px] font-semibold text-muted-foreground/70 px-2 py-1 uppercase tracking-widest">
                Recent
              </p>
              <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
                {recentWorkflows.map((w) => (
                  <Link
                    key={w.id}
                    href={`/workflows/${w.id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                      pathname === `/workflows/${w.id}` &&
                        "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    )}
                  >
                    <Workflow className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{w.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] font-semibold text-muted-foreground/70 px-2 py-1 uppercase tracking-widest">Navigation</p>

          {navItems.map((item) => {
            const isActive = item.url ? pathname === item.url || pathname.startsWith(item.url + "/") : false
            const hasDrilldown = !!item.subItems

            return (
              <div key={item.id}>
                {hasDrilldown ? (
                  <button
                    onClick={() => drillDown(item.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm w-full text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    )}
                  >
                    {item.icon}
                    <span className="flex-1">{item.title}</span>
                    {item.badge && <Badge variant="secondary" className="text-xs">{item.badge}</Badge>}
                    <ChevronRight className="size-3 text-muted-foreground" />
                  </button>
                ) : (
                  <Link
                    href={item.url!}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    )}
                  >
                    {item.icon}
                    <span className="flex-1">{item.title}</span>
                    {item.badge && <Badge variant="secondary" className="text-xs">{item.badge}</Badge>}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    if (activeNavItem?.subItems) {
      return (
        <div className="flex flex-col gap-1 p-2">
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors mb-1"
          >
            <ArrowLeft className="size-4" />
            <span>{activeNavItem.backLabel ?? "Back"}</span>
          </button>
          <p className="text-[10px] font-semibold text-muted-foreground/70 px-2 py-1 uppercase tracking-widest">{activeNavItem.title}</p>
          {activeNavItem.subItems.map((item) => {
            const isActive = pathname === item.url || pathname.startsWith(item.url + "/")
            return (
              <Link
                key={item.id}
                href={item.url}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                )}
              >
                {item.icon}
                <div className="flex-1 min-w-0">
                  <div>{item.title}</div>
                  {item.description && <div className="text-xs text-muted-foreground truncate">{item.description}</div>}
                </div>
                {item.badge && <Badge variant="secondary" className="text-xs">{item.badge}</Badge>}
              </Link>
            )
          })}
        </div>
      )
    }

    return null
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/workflows" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Zap className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Runneroo</span>
                <span className="truncate text-xs text-muted-foreground/70">Workflow automation</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden relative">
        {/* Search overlay */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08 }}
              className="absolute inset-0 z-10 flex flex-col overflow-y-auto bg-sidebar"
            >
              {/* Back nav row — arrow left closes, "Search" label centred, "Clear" on right */}
              <div className="px-2 pt-0 pb-1">
                <button
                  type="button"
                  onClick={closeSearch}
                  className="relative flex items-center w-full px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 absolute left-2" />
                  <span className="flex-1 text-center font-medium">Search</span>
                  {searchQuery.length > 0 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); clearSearch() }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); clearSearch() } }}
                      className="absolute right-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear
                    </span>
                  )}
                </button>
              </div>

              {/* Search input */}
              <div className="px-2 pb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search workflows…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") closeSearch() }}
                    className="w-full h-7 rounded-md text-sm bg-muted border-0 pl-7 pr-3 text-foreground placeholder:text-muted-foreground/40 hover:bg-muted/80 outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                  />
                </div>
              </div>

              <SidebarSeparator />

              {/* Results */}
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {searchQuery.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Type to search workflows, runs, and more
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation panels */}
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={activePanel}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className="absolute inset-0 overflow-y-auto"
          >
            {renderPanel(activePanel)}
          </motion.div>
        </AnimatePresence>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
