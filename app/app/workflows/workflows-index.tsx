"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { PageHeader } from "@/components/page-header"
import {
  Activity,
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock,
  Command as CommandIcon,
  MoreHorizontal,
  Play,
  Plus,
  SearchIcon,
  Webhook,
  Workflow,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { WorkflowListRow } from "@/lib/workflows/queries/queries"
import {
  endOfMonth,
  format,
  parse as parseIsoDate,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns"
import {
  WORKFLOW_OPEN_RUN_INTENT_VALUE,
  workflowOpenRunIntentStorageKey,
} from "@/lib/workflows/workflow-open-run-intent-storage"
import type { DateRange } from "react-day-picker"

const triggerMeta = {
  cron: { icon: Clock, label: "Schedule" },
  webhook: { icon: Webhook, label: "Webhook" },
  manual: { icon: CommandIcon, label: "Manual" },
}

/** Compact filter triggers (matches Usage / Gateway toolbar pills). */
const FILTER_TRIGGER_CLASS =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

/** Maximum workflow rows rendered per page in the table. */
const WORKFLOWS_PAGE_SIZE = 50

type WorkflowTriggerFilter = "all" | WorkflowListRow["trigger_type"]

type WorkflowStatusFilter = "all" | WorkflowListRow["status"]

const TRIGGER_FILTER_OPTIONS: {
  value: WorkflowTriggerFilter
  menuLabel: string
  triggerLabel: string
}[] = [
  { value: "all", menuLabel: "All triggers", triggerLabel: "All triggers" },
  { value: "cron", menuLabel: "Schedule", triggerLabel: "Schedule" },
  { value: "webhook", menuLabel: "Webhook", triggerLabel: "Webhook" },
  { value: "manual", menuLabel: "Manual", triggerLabel: "Manual" },
]

const STATUS_FILTER_OPTIONS: {
  value: WorkflowStatusFilter
  menuLabel: string
  triggerLabel: string
}[] = [
  { value: "all", menuLabel: "All statuses", triggerLabel: "All statuses" },
  { value: "active", menuLabel: "Active", triggerLabel: "Active" },
  { value: "draft", menuLabel: "Draft", triggerLabel: "Draft" },
  { value: "inactive", menuLabel: "Inactive", triggerLabel: "Inactive" },
]

/**
 * Normalises two calendar days to inclusive ISO date strings with the earlier day first.
 */
function normaliseRangeToIsoStrings({
  startDay,
  endDay,
}: {
  startDay: Date
  endDay: Date
}): { startStr: string; endStr: string } {
  const left = startOfDay(startDay)
  const right = startOfDay(endDay)
  if (left <= right) {
    return {
      startStr: format(left, "yyyy-MM-dd"),
      endStr: format(right, "yyyy-MM-dd"),
    }
  }
  return {
    startStr: format(right, "yyyy-MM-dd"),
    endStr: format(left, "yyyy-MM-dd"),
  }
}

/**
 * Label shown on the trigger-type filter control.
 */
function triggerFilterTriggerLabel({
  triggerFilter,
}: {
  triggerFilter: WorkflowTriggerFilter
}): string {
  return (
    TRIGGER_FILTER_OPTIONS.find((opt) => opt.value === triggerFilter)?.triggerLabel ??
    "All triggers"
  )
}

/**
 * Label shown on the status filter control.
 */
function statusFilterTriggerLabel({
  statusFilter,
}: {
  statusFilter: WorkflowStatusFilter
}): string {
  return (
    STATUS_FILTER_OPTIONS.find((opt) => opt.value === statusFilter)?.triggerLabel ?? "All statuses"
  )
}

/**
 * Relative time label for the last workflow run timestamp (updates every minute).
 */
function TimeAgo({ date }: { date: string }) {
  const [label, setLabel] = React.useState("")

  React.useEffect(() => {
    function updateLabel() {
      const diff = Date.now() - new Date(date).getTime()
      const mins = Math.floor(diff / 60000)
      const hours = Math.floor(mins / 60)
      const days = Math.floor(hours / 24)
      if (days > 0) setLabel(`${days}d ago`)
      else if (hours > 0) setLabel(`${hours}h ago`)
      else setLabel(`${Math.max(0, mins)}m ago`)
    }
    updateLabel()
    const id = window.setInterval(updateLabel, 60_000)
    return () => window.clearInterval(id)
  }, [date])

  return <>{label}</>
}

/**
 * Compact status pill for workflow lifecycle state.
 */
function StatusBadge({ status }: { status: "active" | "inactive" | "draft" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        status === "active" &&
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
        status === "draft" && "bg-muted text-muted-foreground",
        status === "inactive" && "bg-muted text-muted-foreground",
      )}
    >
      {status === "active" && (
        <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      )}
      {status}
    </span>
  )
}

/**
 * Short trigger detail line (cron expression, webhook path, or manual).
 */
function triggerSummary(w: WorkflowListRow) {
  const cfg =
    w.trigger_config && typeof w.trigger_config === "object"
      ? (w.trigger_config as Record<string, unknown>)
      : {}
  if (w.trigger_type === "cron") {
    const schedule = typeof cfg.schedule === "string" ? cfg.schedule : "—"
    return schedule
  }
  if (w.trigger_type === "webhook") {
    const path = typeof cfg.path === "string" ? cfg.path : "/webhook"
    return path
  }
  return "Manual"
}

interface WorkflowsIndexProps {
  workflows: WorkflowListRow[]
  /** Extra classes on the outer wrapper (same pattern as usage settings pages). */
  className?: string
}

/**
 * Workflows index: filters (toolbar), overview tiles, and detail table aligned with the Usage settings layout.
 */
export function WorkflowsIndex({ workflows, className }: WorkflowsIndexProps) {
  const router = useRouter()
  const today = React.useMemo(() => new Date(), [])
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const [nameSearch, setNameSearch] = React.useState("")
  const [triggerFilter, setTriggerFilter] = React.useState<WorkflowTriggerFilter>("all")
  const [statusFilter, setStatusFilter] = React.useState<WorkflowStatusFilter>("all")
  const [triggerPickerOpen, setTriggerPickerOpen] = React.useState(false)
  const [statusPickerOpen, setStatusPickerOpen] = React.useState(false)
  const [lastRunPickerOpen, setLastRunPickerOpen] = React.useState(false)

  const [lastRunStartIso, setLastRunStartIso] = React.useState<string | null>(null)
  const [lastRunEndIso, setLastRunEndIso] = React.useState<string | null>(null)

  const dateRangeDraftRef = React.useRef<DateRange | undefined>(undefined)
  const [dateRangeDraft, setDateRangeDraft] = React.useState<DateRange | undefined>(undefined)
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(() => new Date())
  const [page, setPage] = React.useState(1)

  const resetPagination = React.useCallback(() => {
    setPage(1)
  }, [])

  const lastRunFilterActive = lastRunStartIso !== null && lastRunEndIso !== null

  const calendarRange = React.useMemo((): DateRange | undefined => {
    if (!lastRunFilterActive || lastRunStartIso === null || lastRunEndIso === null) {
      return undefined
    }
    const from = parseIsoDate(lastRunStartIso, "yyyy-MM-dd", new Date())
    const to = parseIsoDate(lastRunEndIso, "yyyy-MM-dd", new Date())
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return undefined
    }
    return { from, to }
  }, [lastRunFilterActive, lastRunStartIso, lastRunEndIso])

  const lastRunToolbarLabel = React.useMemo(() => {
    if (!lastRunFilterActive || !calendarRange?.from || !calendarRange.to) {
      return "Any time"
    }
    return `${format(calendarRange.from, "d MMM yyyy")} – ${format(calendarRange.to, "d MMM yyyy")}`
  }, [lastRunFilterActive, calendarRange])

  const applyLastRunRange = React.useCallback(({ from, to }: { from: Date; to: Date }) => {
    const { startStr, endStr } = normaliseRangeToIsoStrings({ startDay: from, endDay: to })
    setLastRunStartIso(startStr)
    setLastRunEndIso(endStr)
    const nextRange: DateRange = {
      from: parseIsoDate(startStr, "yyyy-MM-dd", new Date()),
      to: parseIsoDate(endStr, "yyyy-MM-dd", new Date()),
    }
    dateRangeDraftRef.current = nextRange
    setDateRangeDraft(nextRange)
    setLastRunPickerOpen(false)
    setPage(1)
  }, [])

  const applyPresetThisMonth = React.useCallback(() => {
    const from = startOfMonth(today)
    const to = endOfMonth(today)
    applyLastRunRange({ from, to })
  }, [today, applyLastRunRange])

  const applyPresetLast30Days = React.useCallback(() => {
    const from = startOfDay(subDays(today, 29))
    const to = startOfDay(today)
    applyLastRunRange({ from, to })
  }, [today, applyLastRunRange])

  const clearLastRunFilter = React.useCallback(() => {
    setLastRunStartIso(null)
    setLastRunEndIso(null)
    setLastRunPickerOpen(false)
    setPage(1)
  }, [])

  const handleLastRunPopoverOpenChange = React.useCallback(
    ({ open }: { open: boolean }) => {
      if (open) {
        const initial =
          calendarRange ?? ({ from: startOfMonth(today), to: endOfMonth(today) } satisfies DateRange)
        dateRangeDraftRef.current = initial
        setDateRangeDraft(initial)
        const anchorSource =
          lastRunStartIso !== null
            ? parseIsoDate(lastRunStartIso, "yyyy-MM-dd", new Date())
            : today
        if (!Number.isNaN(anchorSource.getTime())) {
          setCalendarMonth(anchorSource)
        }
        setLastRunPickerOpen(true)
        return
      }
      setLastRunPickerOpen(false)
    },
    [calendarRange, today, lastRunStartIso],
  )

  const filteredWorkflows = React.useMemo(() => {
    const query = nameSearch.trim().toLowerCase()
    return workflows.filter((w) => {
      if (query.length > 0 && !w.name.toLowerCase().includes(query)) {
        return false
      }
      if (triggerFilter !== "all" && w.trigger_type !== triggerFilter) {
        return false
      }
      if (statusFilter !== "all" && w.status !== statusFilter) {
        return false
      }
      if (
        lastRunFilterActive &&
        lastRunStartIso !== null &&
        lastRunEndIso !== null
      ) {
        if (!w.last_run_at) {
          return false
        }
        const runStr = format(startOfDay(new Date(w.last_run_at)), "yyyy-MM-dd")
        if (runStr < lastRunStartIso || runStr > lastRunEndIso) {
          return false
        }
      }
      return true
    })
  }, [
    workflows,
    nameSearch,
    triggerFilter,
    statusFilter,
    lastRunFilterActive,
    lastRunStartIso,
    lastRunEndIso,
  ])

  const totalFiltered = filteredWorkflows.length
  const maxPage = Math.max(1, Math.ceil(totalFiltered / WORKFLOWS_PAGE_SIZE))
  const effectivePage = Math.min(Math.max(1, page), maxPage)
  const pageSliceStart = (effectivePage - 1) * WORKFLOWS_PAGE_SIZE
  const paginatedWorkflows = filteredWorkflows.slice(
    pageSliceStart,
    pageSliceStart + WORKFLOWS_PAGE_SIZE,
  )

  const pageRangeLabel = React.useMemo(() => {
    if (totalFiltered === 0) {
      return "No rows"
    }
    const startIdx = pageSliceStart + 1
    const endIdx = Math.min(pageSliceStart + WORKFLOWS_PAGE_SIZE, totalFiltered)
    return `${startIdx}–${endIdx} of ${totalFiltered}`
  }, [totalFiltered, pageSliceStart])

  const hasNonDefaultFilters =
    nameSearch.trim().length > 0 ||
    triggerFilter !== "all" ||
    statusFilter !== "all" ||
    lastRunFilterActive

  const activeCount = filteredWorkflows.filter((w) => w.status === "active").length
  const totalRuns = filteredWorkflows.reduce((acc, w) => acc + w.run_count, 0)
  const triggerKinds = new Set(filteredWorkflows.map((w) => w.trigger_type)).size

  const triggerScopeBadge = triggerFilter === "all" ? "3/3" : "1/3"
  const statusScopeBadge = statusFilter === "all" ? "3/3" : "1/3"

  async function handleDeleteWorkflow({ workflowId }: { workflowId: string }) {
    if (!window.confirm("Delete this workflow? This cannot be undone.")) return
    setDeletingId(workflowId)
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, { method: "DELETE" })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        window.alert(json.error ?? "Could not delete workflow")
        return
      }
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)} data-testid="auth-app-shell">
      {/* ── Page title (fixed header row) ── */}
      <PageHeader title="Workflows" description="Build and automate your processes">
        <Button asChild size="sm" className="h-7 w-7 shrink-0 p-0" aria-label="New workflow">
          <Link href="/app/workflows/new">
            <Plus className="size-3.5" />
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-6 p-6">
        {/* ── Filter toolbar: search left, pills right (Usage-style) ── */}
        <div className="flex min-w-0 flex-col gap-2 pb-0.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          {/* Search by name */}
          <div
            className={cn(
              FILTER_TRIGGER_CLASS,
              "min-h-9 w-full min-w-0 max-w-md flex-1 justify-start gap-2 py-0 pl-2 pr-2 lg:max-w-md",
            )}
          >
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              value={nameSearch}
              onChange={(event) => {
                setNameSearch(event.target.value)
                resetPagination()
              }}
              placeholder="Search by name…"
              className="h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Search workflows by name"
            />
          </div>

          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-start gap-2 overflow-x-auto lg:justify-end">
            {/* Last run date range */}
            <Popover
              open={lastRunPickerOpen}
              onOpenChange={(open) => handleLastRunPopoverOpenChange({ open })}
            >
              <PopoverTrigger asChild>
                <button type="button" className={cn(FILTER_TRIGGER_CLASS, "max-w-[min(100%,22rem)]")}>
                  <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">Last run</span>
                  <span className="max-w-[14rem] truncate font-medium text-foreground">
                    {lastRunToolbarLabel}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex flex-col gap-2 border-b border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Filter workflows whose last run falls on these calendar days (inclusive). Workflows
                    with no runs yet are hidden while a range is set.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={applyPresetThisMonth}>
                      This month
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={applyPresetLast30Days}>
                      Last 30 days
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearLastRunFilter}>
                      Any time
                    </Button>
                  </div>
                </div>
                <Calendar
                  mode="range"
                  resetOnSelect
                  required={false}
                  captionLayout="dropdown"
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  numberOfMonths={2}
                  selected={lastRunPickerOpen ? dateRangeDraft : calendarRange}
                  onSelect={(range) => {
                    dateRangeDraftRef.current = range
                    setDateRangeDraft(range)
                    if (range?.from !== undefined && range.to !== undefined) {
                      applyLastRunRange({ from: range.from, to: range.to })
                    }
                  }}
                />
              </PopoverContent>
            </Popover>

            {/* Trigger type */}
            <Popover open={triggerPickerOpen} onOpenChange={setTriggerPickerOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={FILTER_TRIGGER_CLASS}>
                  <span className="flex items-center gap-0.5" aria-hidden>
                    <span className="size-1.5 rounded-full bg-sky-500" />
                    <span className="size-1.5 rounded-full bg-violet-500" />
                    <span className="size-1.5 rounded-full bg-amber-500" />
                  </span>
                  <span className="text-muted-foreground">Type</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {triggerScopeBadge}
                  </span>
                  <span className="max-w-[10rem] truncate font-medium text-foreground">
                    {triggerFilterTriggerLabel({ triggerFilter })}
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 opacity-60" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[16rem] p-0">
                <Command>
                  <CommandInput placeholder="Search trigger types…" />
                  <CommandList>
                    <CommandEmpty>No trigger type found.</CommandEmpty>
                    <CommandGroup>
                      {TRIGGER_FILTER_OPTIONS.map((opt) => (
                        <CommandItem
                          key={opt.value}
                          value={opt.value}
                          keywords={[opt.menuLabel, opt.triggerLabel]}
                          onSelect={() => {
                            setTriggerFilter(opt.value)
                            resetPagination()
                            setTriggerPickerOpen(false)
                          }}
                        >
                          {opt.menuLabel}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Status (Usage type-picker pattern) */}
            <Popover open={statusPickerOpen} onOpenChange={setStatusPickerOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={FILTER_TRIGGER_CLASS}>
                  <span className="flex items-center gap-0.5" aria-hidden>
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    <span className="size-1.5 rounded-full bg-slate-400" />
                  </span>
                  <span className="text-muted-foreground">Status</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {statusScopeBadge}
                  </span>
                  <span className="max-w-[10rem] truncate font-medium text-foreground">
                    {statusFilterTriggerLabel({ statusFilter })}
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 opacity-60" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[16rem] p-0">
                <Command>
                  <CommandInput placeholder="Search statuses…" />
                  <CommandList>
                    <CommandEmpty>No status found.</CommandEmpty>
                    <CommandGroup>
                      {STATUS_FILTER_OPTIONS.map((opt) => (
                        <CommandItem
                          key={opt.value}
                          value={opt.value}
                          keywords={[opt.menuLabel, opt.triggerLabel]}
                          onSelect={() => {
                            setStatusFilter(opt.value)
                            resetPagination()
                            setStatusPickerOpen(false)
                          }}
                        >
                          {opt.menuLabel}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* ── Overview totals (filtered set; matches Usage summary tiles) ── */}
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-foreground">Overview</p>
          <p className="text-xs text-muted-foreground">
            Summary counts include every workflow that matches your filters (not only the current page).
            Adjust search and filters to change what is included.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total workflows
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                {filteredWorkflows.length}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                {activeCount}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total runs</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                {totalRuns.toLocaleString("en-AU")}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Trigger types
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{triggerKinds}</p>
            </div>
          </div>
        </div>

        {/* ── Workflow table ── */}
        <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3 text-right">Runs</th>
                <th className="px-4 py-3 text-right">Last run</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workflows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                        <Workflow className="size-6 text-muted-foreground/50" aria-hidden />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">No workflows yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Create your first workflow to get started.
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <Link href="/app/workflows/new">
                          <Plus className="size-3.5" aria-hidden />
                          New workflow
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : filteredWorkflows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <p className="font-medium text-foreground">No workflows match your filters</p>
                    <p className="mt-1 text-sm">
                      Try clearing search, changing trigger or status, setting last run to{' '}
                      <span className="whitespace-nowrap">Any time</span>, or broadening the date range.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedWorkflows.map((workflow) => {
                  const tMeta = triggerMeta[workflow.trigger_type] ?? triggerMeta.manual
                  const TIcon = tMeta.icon

                  return (
                    <tr
                      key={workflow.id}
                      className="border-b border-border/80 last:border-0 transition-colors hover:bg-muted/30"
                    >
                      {/* Name + optional description */}
                      <td className="max-w-[18rem] px-4 py-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <Workflow className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <div className="min-w-0">
                            <Link
                              href={`/app/workflows/${workflow.id}`}
                              className="truncate font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {workflow.name}
                            </Link>
                            {workflow.description ? (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {workflow.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={workflow.status} />
                      </td>
                      {/* Trigger kind + detail */}
                      <td className="max-w-[14rem] px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5 text-foreground">
                          <TIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="font-medium">{tMeta.label}</span>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                          {triggerSummary(workflow)}
                        </p>
                      </td>
                      {/* Runs */}
                      <td className="px-4 py-3 text-right align-top tabular-nums">
                        <span className="inline-flex items-center justify-end gap-1">
                          <Activity className="size-3.5 text-muted-foreground" aria-hidden />
                          {workflow.run_count.toLocaleString("en-AU")}
                        </span>
                      </td>
                      {/* Last run */}
                      <td className="px-4 py-3 text-right align-top text-muted-foreground">
                        {workflow.last_run_at ? (
                          <span className="inline-flex items-center justify-end gap-1 tabular-nums">
                            <Play className="size-3.5 shrink-0" aria-hidden />
                            <TimeAgo date={workflow.last_run_at} />
                          </span>
                        ) : (
                          <span className="tabular-nums">—</span>
                        )}
                      </td>
                      {/* Row actions */}
                      <td className="px-4 py-3 text-right align-top">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon-sm" variant="ghost" aria-label="More options">
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => {
                                  try {
                                    if (typeof window.sessionStorage?.setItem === "function") {
                                      sessionStorage.setItem(
                                        workflowOpenRunIntentStorageKey({ workflowId: workflow.id }),
                                        WORKFLOW_OPEN_RUN_INTENT_VALUE
                                      )
                                    }
                                  } catch {
                                    /* private / blocked storage — still navigate */
                                  }
                                  router.push(`/app/workflows/${workflow.id}`)
                                }}
                              >
                                <Play className="size-3.5 fill-current" aria-hidden />
                                Run
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => router.push(`/app/workflows/${workflow.id}`)}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled>Duplicate</DropdownMenuItem>
                              <DropdownMenuItem disabled>View runs</DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={deletingId === workflow.id}
                                onClick={() =>
                                  void handleDeleteWorkflow({ workflowId: workflow.id })
                                }
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer: counts + pagination ── */}
        {workflows.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Rows are ordered by last updated (newest first).
              {hasNonDefaultFilters ? (
                <>
                  {" "}
                  <span className="tabular-nums">
                    {totalFiltered} matching workflow{totalFiltered === 1 ? "" : "s"}
                  </span>{" "}
                  from <span className="tabular-nums">{workflows.length}</span> loaded.
                </>
              ) : null}
            </p>

            {totalFiltered > 0 ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{pageRangeLabel}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={effectivePage <= 1}
                    onClick={() => setPage(effectivePage - 1)}
                  >
                    <ChevronLeftIcon className="size-4" aria-hidden />
                    Previous
                  </Button>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    Page {effectivePage} / {maxPage}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={effectivePage >= maxPage}
                    onClick={() => setPage(effectivePage + 1)}
                  >
                    Next
                    <ChevronRightIcon className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
