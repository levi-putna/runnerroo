"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Book,
  BrainIcon,
  ChevronRight,
  Files,
  GitBranch,
  HelpCircle,
  History,
  Inbox,
  MessageSquareIcon,
  Search,
  Settings,
  Workflow,
} from "lucide-react"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { DailifyMark, DailifyWordmark } from "@/components/brand/dailify-logos"
import { NavUser } from "@/components/nav-user"
import type { WorkflowListRow } from "@/lib/workflows/queries/queries"

interface User {
  name: string
  email: string
  avatar: string
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
    id: "assistant",
    title: "Chat",
    url: "/app/chat",
    icon: <MessageSquareIcon className="size-4" />,
  },
  {
    id: "history",
    title: "History",
    icon: <History className="size-4" />,
    backLabel: "Navigation",
    subItems: [],
  },
  {
    id: "workflows",
    title: "Workflows",
    url: "/app/workflows",
    icon: <Workflow className="size-4" />,
  },
  {
    id: "runs",
    title: "Runs",
    url: "/app/run",
    icon: <Activity className="size-4" />,
  },
  {
    id: "inbox",
    title: "Inbox",
    url: "/app/inbox",
    icon: <Inbox className="size-4" />,
  },
  {
    id: "artifacts",
    title: "Artefacts",
    url: "/app/artifacts",
    icon: <Files className="size-4" />,
  },
  {
    id: "settings",
    title: "Settings",
    icon: <Settings className="size-4" />,
    backLabel: "Navigation",
    subItems: [
      { id: "profile", title: "Profile", url: "/app/settings/profile", icon: <Settings className="size-4" /> },
      { id: "integrations", title: "Integrations", url: "/app/settings/integrations", icon: <GitBranch className="size-4" /> },
      { id: "usage", title: "Usage", url: "/app/settings/usage", icon: <BarChart3 className="size-4" /> },
      { id: "memories", title: "Memories", url: "/app/settings/memories", icon: <BrainIcon className="size-4" /> },
      { id: "docs", title: "Documentation", url: "https://docs.runneroo.io", icon: <Book className="size-4" /> },
      { id: "help", title: "Help & Support", url: "/app/help", icon: <HelpCircle className="size-4" /> },
    ],
  },
]

/** Nav item ids grouped under the Assistant heading. */
const ASSISTANT_SECTION_NAV_IDS = new Set(["assistant", "history"])

/** Nav item ids grouped under the Workflow heading. */
const WORKFLOW_SECTION_NAV_IDS = new Set(["workflows", "runs", "inbox"])

/** All ids rendered in structured Assistant / Workflow blocks (excluded from core nav). */
const SIDEBAR_STRUCTURED_NAV_IDS = new Set<string>([
  ...ASSISTANT_SECTION_NAV_IDS,
  ...WORKFLOW_SECTION_NAV_IDS,
])

/**
 * Primary app navigation with optional recent workflows under the composer entry point.
 */
export function AppSidebar({
  user,
  recentWorkflows,
  pendingApprovalCount = 0,
}: {
  user: User
  recentWorkflows: WorkflowListRow[]
  pendingApprovalCount?: number
}) {
  const navItemsEffective = React.useMemo(
    () =>
      navItems.map((item) =>
        item.id === "inbox" && pendingApprovalCount > 0
          ? { ...item, badge: pendingApprovalCount }
          : item,
      ),
    [pendingApprovalCount],
  )

  const [panelStack, setPanelStack] = React.useState<string[]>(["root"])
  const [direction, setDirection] = React.useState(1)
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [conversationHistory, setConversationHistory] = React.useState<
    Array<{ id: string; title: string; updated_at: string }>
  >([])
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const activePanel = panelStack[panelStack.length - 1]

  // Load conversations when History panel is opened
  React.useEffect(() => {
    if (activePanel !== "history") return
    void fetch("/api/conversations")
      .then((res) => (res.ok ? res.json() : null))
      .then((rows) => {
        if (Array.isArray(rows)) setConversationHistory(rows)
      })
      .catch(() => {})
  }, [activePanel])

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

  const activeNavItem = navItemsEffective.find((i) => i.id === activePanel)

  /**
   * Sidebar row for root panel items — direct link or drill-down (e.g. History).
   */
  function renderRootNavLinkOrDrilldown(item: NavItem) {
    const isActive = item.url
      ? pathname === item.url || pathname.startsWith(item.url + "/")
      : false
    const hasDrilldown = !!item.subItems

    if (hasDrilldown) {
      return (
        <button
          type="button"
          onClick={() => drillDown(item.id)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          )}
        >
          {item.icon}
          <span className="flex-1">{item.title}</span>
          {item.badge && <Badge variant="secondary" className="text-xs">{item.badge}</Badge>}
          <ChevronRight className="size-3 text-muted-foreground" />
        </button>
      )
    }

    return (
      <Link
        href={item.url!}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
        )}
      >
        {item.icon}
        <span className="flex-1">{item.title}</span>
        {item.badge && <Badge variant="secondary" className="text-xs">{item.badge}</Badge>}
      </Link>
    )
  }

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

          {/* Assistant — composer and conversation history */}
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Assistant
          </p>
          <div className="mb-1 flex flex-col gap-0.5">
            {navItemsEffective
              .filter((i) => ASSISTANT_SECTION_NAV_IDS.has(i.id))
              .map((item) => (
                <div key={item.id}>{renderRootNavLinkOrDrilldown(item)}</div>
              ))}
          </div>

          {/* Between Assistant block and Workflow block */}
          <SidebarSeparator className="my-2 bg-sidebar-border/45" />

          {/* Workflow — definitions and runs */}
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Workflow
          </p>
          <div className="mb-1 flex flex-col gap-0.5">
            {navItemsEffective
              .filter((i) => WORKFLOW_SECTION_NAV_IDS.has(i.id))
              .map((item) => (
                <div key={item.id}>{renderRootNavLinkOrDrilldown(item)}</div>
              ))}
          </div>

          {/* Between Workflow block and artefacts / settings */}
          <SidebarSeparator className="my-2 bg-sidebar-border/45" />

          {/* Core navigation */}
          {navItemsEffective.filter((i) => !SIDEBAR_STRUCTURED_NAV_IDS.has(i.id)).map((item) => (
            <div key={item.id}>{renderRootNavLinkOrDrilldown(item)}</div>
          ))}

          {/* Recent workflows */}
          {recentWorkflows.length > 0 && (
            <>
              <SidebarSeparator className="my-2" />
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Recent
              </p>
              <div className="flex flex-col gap-0.5">
                {recentWorkflows.slice(0, 8).map((w) => {
                  const href = `/app/workflows/${w.id}`
                  const isActive = pathname === href || pathname.startsWith(`${href}/`)
                  return (
                    <Link
                      key={w.id}
                      href={href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      )}
                      title={w.name}
                    >
                      <Workflow className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )
    }

    if (panelId === "history") {
      return (
        <div className="flex flex-col gap-1 p-2">
          <button
            type="button"
            onClick={goBack}
            className="mb-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <ArrowLeft className="size-4" />
            <span>Navigation</span>
          </button>

          {conversationHistory.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground text-center">No conversations yet</p>
          ) : (
            conversationHistory.map((convo) => (
              <Link
                key={convo.id}
                href={`/app/chat/${convo.id}`}
                className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <span className="truncate font-medium">{convo.title}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(convo.updated_at).toLocaleDateString()}
                </span>
              </Link>
            ))
          )}
        </div>
      )
    }

    if (activeNavItem?.subItems && activeNavItem.subItems.length > 0) {
      return (
        <div className="flex flex-col gap-1 p-2">
          <button
            type="button"
            onClick={goBack}
            className="mb-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <ArrowLeft className="size-4" />
            <span>{activeNavItem.backLabel ?? "Back"}</span>
          </button>

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
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="gap-0 p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Brand — mark + wordmark */}
            <SidebarMenuButton
              size="lg"
              tooltip="Dailify"
              className="py-1.5"
              render={<Link href="/app/workflows" />}
            >
              <DailifyMark className="!h-9 !w-auto shrink-0 text-sidebar-foreground" />
              <div className="flex min-w-0 flex-1 items-center group-data-[collapsible=icon]:hidden">
                <DailifyWordmark className="!h-6 !w-auto max-w-full text-sidebar-foreground" />
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
