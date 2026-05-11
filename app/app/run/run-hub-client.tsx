"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
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
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock,
  Command as CommandIcon,
  SearchIcon,
  Webhook,
  Workflow,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { WorkflowRunListItem } from "@/lib/workflows/queries/run-queries"
import { RunStatusGlyph } from "@/components/workflow/run-status-glyph"
import {
  displayRunDuration,
  formatRunLocalDate,
  runPersistedLifecycleLabel,
} from "@/lib/workflows/engine/run-formatting"
import { shortRunIdForDisplay } from "@/lib/workflows/engine/run-timeline"
import {
  endOfMonth,
  format,
  parse as parseIsoDate,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns"
import type { DateRange } from "react-day-picker"

/** Maximum rows rendered per page in the runs table. */
const RUNS_PAGE_SIZE = 50

/** Compact filter triggers (matches Usage / Workflows toolbar pills). */
const FILTER_TRIGGER_CLASS =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

const triggerMeta = {
  cron: { icon: Clock, label: "Schedule" },
  webhook: { icon: Webhook, label: "Webhook" },
  manual: { icon: CommandIcon, label: "Manual" },
}

type RunTriggerFilter = "all" | WorkflowRunListItem["trigger_type"]

type RunStatusFilter = "all" | WorkflowRunListItem["status"]

const TRIGGER_FILTER_OPTIONS: {
  value: RunTriggerFilter
  menuLabel: string
  triggerLabel: string
}[] = [
  { value: "all", menuLabel: "All triggers", triggerLabel: "All triggers" },
  { value: "cron", menuLabel: "Schedule", triggerLabel: "Schedule" },
  { value: "webhook", menuLabel: "Webhook", triggerLabel: "Webhook" },
  { value: "manual", menuLabel: "Manual", triggerLabel: "Manual" },
]

const STATUS_FILTER_OPTIONS: {
  value: RunStatusFilter
  menuLabel: string
  triggerLabel: string
}[] = [
  { value: "all", menuLabel: "All statuses", triggerLabel: "All statuses" },
  { value: "running", menuLabel: "Running", triggerLabel: "Running" },
  { value: "success", menuLabel: "Completed", triggerLabel: "Completed" },
  { value: "failed", menuLabel: "Failed", triggerLabel: "Failed" },
  { value: "cancelled", menuLabel: "Cancelled", triggerLabel: "Cancelled" },
  { value: "waiting_approval", menuLabel: "Awaiting approval", triggerLabel: "Awaiting approval" },
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
function triggerFilterTriggerLabel({ triggerFilter }: { triggerFilter: RunTriggerFilter }): string {
  return (
    TRIGGER_FILTER_OPTIONS.find((opt) => opt.value === triggerFilter)?.triggerLabel ?? "All triggers"
  )
}

/**
 * Label shown on the status filter control.
 */
function statusFilterTriggerLabel({ statusFilter }: { statusFilter: RunStatusFilter }): string {
  return (
    STATUS_FILTER_OPTIONS.find((opt) => opt.value === statusFilter)?.triggerLabel ?? "All statuses"
  )
}

type WorkflowFilter = "all" | string

/**
 * Label shown on the workflow filter control.
 */
function workflowFilterTriggerLabel({
  workflowFilter,
  workflows,
}: {
  workflowFilter: WorkflowFilter
  workflows: { id: string; name: string }[]
}): string {
  if (workflowFilter === "all") {
    return "All workflows"
  }
  const row = workflows.find((w) => w.id === workflowFilter)
  return row?.name?.trim() || "Untitled workflow"
}

export interface WorkflowRunHubClientProps {
  runs: WorkflowRunListItem[]
  /** All workflows the user can scope runs to (dropdown source). */
  workflows: { id: string; name: string }[]
  /** When set, the workflow filter starts on this id (must exist in {@link workflows}). */
  initialWorkflowId: string | null
  /** Extra classes on the outer wrapper (matches workflows / usage pages). */
  className?: string
}

/**
 * Run hub: Usage-style filters and overview tiles, bordered detail table, links into run detail.
 */
function WorkflowRunHubClientInner({
  runs,
  workflows,
  initialWorkflowId,
  className,
}: WorkflowRunHubClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const today = React.useMemo(() => new Date(), [])

  const workflowsSorted = React.useMemo(() => {
    return [...workflows].sort((a, b) =>
      (a.name?.trim() || "Untitled workflow").localeCompare(
        b.name?.trim() || "Untitled workflow",
        undefined,
        { sensitivity: "base" },
      ),
    )
  }, [workflows])

  const [nameSearch, setNameSearch] = React.useState("")
  const [workflowFilter, setWorkflowFilter] = React.useState<WorkflowFilter>(() => {
    if (initialWorkflowId != null && workflows.some((w) => w.id === initialWorkflowId)) {
      return initialWorkflowId
    }
    return "all"
  })
  const [triggerFilter, setTriggerFilter] = React.useState<RunTriggerFilter>("all")
  const [statusFilter, setStatusFilter] = React.useState<RunStatusFilter>("all")
  const [workflowPickerOpen, setWorkflowPickerOpen] = React.useState(false)
  const [triggerPickerOpen, setTriggerPickerOpen] = React.useState(false)
  const [statusPickerOpen, setStatusPickerOpen] = React.useState(false)
  const [startedPickerOpen, setStartedPickerOpen] = React.useState(false)

  const [startedStartIso, setStartedStartIso] = React.useState<string | null>(null)
  const [startedEndIso, setStartedEndIso] = React.useState<string | null>(null)

  const dateRangeDraftRef = React.useRef<DateRange | undefined>(undefined)
  const [dateRangeDraft, setDateRangeDraft] = React.useState<DateRange | undefined>(undefined)
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(() => new Date())
  const [page, setPage] = React.useState(1)

  const resetPagination = React.useCallback(() => {
    setPage(1)
  }, [])

  const applyWorkflowFilter = React.useCallback(
    ({ next }: { next: WorkflowFilter }) => {
      setWorkflowFilter(next)
      resetPagination()
      setWorkflowPickerOpen(false)
      const params = new URLSearchParams(searchParams.toString())
      if (next === "all") {
        params.delete("workflow")
      } else {
        params.set("workflow", next)
      }
      const qs = params.toString()
      router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, resetPagination, router, searchParams],
  )

  const startedRangeActive = startedStartIso !== null && startedEndIso !== null

  const calendarRange = React.useMemo((): DateRange | undefined => {
    if (!startedRangeActive || startedStartIso === null || startedEndIso === null) {
      return undefined
    }
    const from = parseIsoDate(startedStartIso, "yyyy-MM-dd", new Date())
    const to = parseIsoDate(startedEndIso, "yyyy-MM-dd", new Date())
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return undefined
    }
    return { from, to }
  }, [startedRangeActive, startedStartIso, startedEndIso])

  const startedToolbarLabel = React.useMemo(() => {
    if (!startedRangeActive || !calendarRange?.from || !calendarRange.to) {
      return "Any time"
    }
    return `${format(calendarRange.from, "d MMM yyyy")} – ${format(calendarRange.to, "d MMM yyyy")}`
  }, [startedRangeActive, calendarRange])

  const applyStartedRange = React.useCallback(({ from, to }: { from: Date; to: Date }) => {
    const { startStr, endStr } = normaliseRangeToIsoStrings({ startDay: from, endDay: to })
    setStartedStartIso(startStr)
    setStartedEndIso(endStr)
    const nextRange: DateRange = {
      from: parseIsoDate(startStr, "yyyy-MM-dd", new Date()),
      to: parseIsoDate(endStr, "yyyy-MM-dd", new Date()),
    }
    dateRangeDraftRef.current = nextRange
    setDateRangeDraft(nextRange)
    setStartedPickerOpen(false)
    setPage(1)
  }, [])

  const applyPresetThisMonth = React.useCallback(() => {
    applyStartedRange({ from: startOfMonth(today), to: endOfMonth(today) })
  }, [today, applyStartedRange])

  const applyPresetLast30Days = React.useCallback(() => {
    applyStartedRange({ from: startOfDay(subDays(today, 29)), to: startOfDay(today) })
  }, [today, applyStartedRange])

  const clearStartedFilter = React.useCallback(() => {
    setStartedStartIso(null)
    setStartedEndIso(null)
    setStartedPickerOpen(false)
    setPage(1)
  }, [])

  const handleStartedPopoverOpenChange = React.useCallback(
    ({ open }: { open: boolean }) => {
      if (open) {
        const initial =
          calendarRange ?? ({ from: startOfMonth(today), to: endOfMonth(today) } satisfies DateRange)
        dateRangeDraftRef.current = initial
        setDateRangeDraft(initial)
        const anchorSource =
          startedStartIso !== null
            ? parseIsoDate(startedStartIso, "yyyy-MM-dd", new Date())
            : today
        if (!Number.isNaN(anchorSource.getTime())) {
          setCalendarMonth(anchorSource)
        }
        setStartedPickerOpen(true)
        return
      }
      setStartedPickerOpen(false)
    },
    [calendarRange, today, startedStartIso],
  )

  const filteredRuns = React.useMemo(() => {
    const query = nameSearch.trim().toLowerCase()
    return runs.filter((run) => {
      const wfName = run.workflows?.name?.trim() || "Untitled workflow"
      const runIdLine = run.wdk_run_id?.trim() || shortRunIdForDisplay(run.id)
      if (query.length > 0) {
        const haystack = `${wfName.toLowerCase()} ${runIdLine.toLowerCase()} ${run.id.toLowerCase()}`
        if (!haystack.includes(query)) {
          return false
        }
      }
      if (workflowFilter !== "all" && run.workflow_id !== workflowFilter) {
        return false
      }
      if (triggerFilter !== "all" && run.trigger_type !== triggerFilter) {
        return false
      }
      if (statusFilter !== "all" && run.status !== statusFilter) {
        return false
      }
      if (startedRangeActive && startedStartIso !== null && startedEndIso !== null) {
        const startStr = format(startOfDay(new Date(run.started_at)), "yyyy-MM-dd")
        if (startStr < startedStartIso || startStr > startedEndIso) {
          return false
        }
      }
      return true
    })
  }, [
    runs,
    nameSearch,
    workflowFilter,
    triggerFilter,
    statusFilter,
    startedRangeActive,
    startedStartIso,
    startedEndIso,
  ])

  const totalFiltered = filteredRuns.length
  const maxPage = Math.max(1, Math.ceil(totalFiltered / RUNS_PAGE_SIZE))
  const effectivePage = Math.min(Math.max(1, page), maxPage)
  const pageSliceStart = (effectivePage - 1) * RUNS_PAGE_SIZE
  const paginatedRuns = filteredRuns.slice(pageSliceStart, pageSliceStart + RUNS_PAGE_SIZE)

  const pageRangeLabel = React.useMemo(() => {
    if (totalFiltered === 0) {
      return "No rows"
    }
    const startIdx = pageSliceStart + 1
    const endIdx = Math.min(pageSliceStart + RUNS_PAGE_SIZE, totalFiltered)
    return `${startIdx}–${endIdx} of ${totalFiltered}`
  }, [totalFiltered, pageSliceStart])

  const hasNonDefaultFilters =
    nameSearch.trim().length > 0 ||
    workflowFilter !== "all" ||
    triggerFilter !== "all" ||
    statusFilter !== "all" ||
    startedRangeActive

  const workflowOptionCount = workflows.length + 1
  const workflowScopeBadge =
    workflowFilter === "all" ? `${workflowOptionCount}/${workflowOptionCount}` : `1/${workflowOptionCount}`

  const completedCount = filteredRuns.filter((r) => r.status === "success").length
  const failedCount = filteredRuns.filter((r) => r.status === "failed").length
  const cancelledCount = filteredRuns.filter((r) => r.status === "cancelled").length
  const runningCount = filteredRuns.filter((r) => r.status === "running").length
  const waitingApprovalCount = filteredRuns.filter((r) => r.status === "waiting_approval").length

  const triggerScopeBadge = triggerFilter === "all" ? "3/3" : "1/3"
  const statusScopeBadge = statusFilter === "all" ? "6/6" : "1/6"

  return (
    <div className={cn("flex min-h-0 flex-col bg-background", className)}>
      {/* ── Page title (fixed header row) ── */}
      <PageHeader
        title="Runs"
        description="Recent executions stored for your workflows. Open a row for the waterfall, trigger payload, and per-step payloads."
      />

      <div className="flex flex-col gap-6 p-6">
        {/* ── Filter toolbar ── */}
        <div className="flex min-w-0 flex-col gap-2 pb-0.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
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
              placeholder="Search by workflow or run id…"
              className="h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Search runs by workflow name or run id"
            />
          </div>

          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-start gap-2 overflow-x-auto lg:justify-end">
            <Popover
              open={startedPickerOpen}
              onOpenChange={(open) => handleStartedPopoverOpenChange({ open })}
            >
              <PopoverTrigger asChild>
                <button type="button" className={cn(FILTER_TRIGGER_CLASS, "max-w-[min(100%,22rem)]")}>
                  <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">Started</span>
                  <span className="max-w-[14rem] truncate font-medium text-foreground">
                    {startedToolbarLabel}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex flex-col gap-2 border-b border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Filter runs whose start time falls on these calendar days (inclusive, local date).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={applyPresetThisMonth}>
                      This month
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={applyPresetLast30Days}>
                      Last 30 days
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearStartedFilter}>
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
                  selected={startedPickerOpen ? dateRangeDraft : calendarRange}
                  onSelect={(range) => {
                    dateRangeDraftRef.current = range
                    setDateRangeDraft(range)
                    if (range?.from !== undefined && range.to !== undefined) {
                      applyStartedRange({ from: range.from, to: range.to })
                    }
                  }}
                />
              </PopoverContent>
            </Popover>

            {/* Workflow scope */}
            <Popover open={workflowPickerOpen} onOpenChange={setWorkflowPickerOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={FILTER_TRIGGER_CLASS}>
                  <Workflow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">Workflow</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {workflowScopeBadge}
                  </span>
                  <span className="max-w-[12rem] truncate font-medium text-foreground">
                    {workflowFilterTriggerLabel({ workflowFilter, workflows })}
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 opacity-60" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(100vw-2rem,22rem)] p-0">
                <Command>
                  <CommandInput placeholder="Search workflows…" />
                  <CommandList>
                    <CommandEmpty>No workflow found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all_workflows__"
                        keywords={["All workflows", "all"]}
                        onSelect={() => {
                          applyWorkflowFilter({ next: "all" })
                        }}
                      >
                        All workflows
                      </CommandItem>
                      {workflowsSorted.map((wf) => (
                        <CommandItem
                          key={wf.id}
                          value={wf.id}
                          keywords={[wf.name?.trim() || "Untitled workflow", wf.id]}
                          onSelect={() => {
                            applyWorkflowFilter({ next: wf.id })
                          }}
                        >
                          {wf.name?.trim() || "Untitled workflow"}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

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

            <Popover open={statusPickerOpen} onOpenChange={setStatusPickerOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={FILTER_TRIGGER_CLASS}>
                  <span className="flex items-center gap-0.5" aria-hidden>
                    <span className="size-1.5 rounded-full bg-sky-500" />
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span className="size-1.5 rounded-full bg-red-500" />
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

        {/* ── Overview (filtered) ── */}
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-foreground">Overview</p>
          <p className="text-xs text-muted-foreground">
            Summary counts include every run that matches your filters (not only the current page). Adjust search and filters to change what is included.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total runs
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{filteredRuns.length}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                {completedCount}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Failed</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-red-600 dark:text-red-400">
                {failedCount}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Running · awaiting approval · cancelled
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
                <span className="tabular-nums">{runningCount}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="tabular-nums">{waitingApprovalCount}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="tabular-nums">{cancelledCount}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                        <Workflow className="size-6 text-muted-foreground/50" aria-hidden />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">No saved runs yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Execute a workflow from the editor to populate this list.
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/app/workflows">Go to workflows</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <p className="font-medium text-foreground">No runs match your filters</p>
                    <p className="mt-1 text-sm">
                      Try clearing search, widening the started date range, or resetting workflow, trigger, and status
                      filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRuns.map((run) => {
                  const runIdLine = run.wdk_run_id?.trim() || shortRunIdForDisplay(run.id)
                  const wfName = run.workflows?.name?.trim() || "Untitled workflow"
                  const href = `/app/run/${run.id}`
                  const tMeta = triggerMeta[run.trigger_type] ?? triggerMeta.manual
                  const TIcon = tMeta.icon

                  return (
                    <tr
                      key={run.id}
                      className="border-b border-border/80 last:border-0 transition-colors hover:bg-muted/30"
                    >
                      {/* Workflow + run id (links — same pattern as workflows name column) */}
                      <td className="max-w-[20rem] px-4 py-3 align-top">
                        <div className="min-w-0 space-y-1">
                          <Link
                            href={href}
                            className="block truncate font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {wfName}
                          </Link>
                          <Link
                            href={href}
                            className="block truncate font-mono text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                          >
                            {runIdLine}
                          </Link>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <RunStatusGlyph status={run.status} className="size-4 shrink-0" />
                          <span className="font-medium wrap-break-word">
                            {runPersistedLifecycleLabel(run.status)}
                          </span>
                        </div>
                      </td>

                      {/* Trigger */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <TIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <Badge variant="outline" className="font-normal uppercase">
                            {run.trigger_type}
                          </Badge>
                        </div>
                      </td>

                      {/* Started */}
                      <td className="px-4 py-3 align-top tabular-nums text-muted-foreground">
                        {formatRunLocalDate(run.started_at)}
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 text-right align-top font-medium tabular-nums whitespace-nowrap">
                        {run.status === "waiting_approval"
                          ? "Paused for approval…"
                          : displayRunDuration(run.duration_ms)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer: counts + pagination ── */}
        {runs.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Rows are ordered by start time (newest first).
              {hasNonDefaultFilters ? (
                <>
                  {" "}
                  <span className="tabular-nums">
                    {totalFiltered} matching run{totalFiltered === 1 ? "" : "s"}
                  </span>{" "}
                  from <span className="tabular-nums">{runs.length}</span> loaded.
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

/**
 * Runs hub entry: wraps the interactive client in a React `Suspense` boundary for `useSearchParams`.
 */
export function WorkflowRunHubClient(props: WorkflowRunHubClientProps) {
  return (
    <React.Suspense
      fallback={
        <div className={cn("flex min-h-0 flex-col bg-background", props.className)}>
          {/* Loading shell — matches Runs layout */}
          <PageHeader
            title="Runs"
            description="Recent executions stored for your workflows. Open a row for the waterfall, trigger payload, and per-step payloads."
          />
          <div className="flex flex-col gap-6 p-6">
            <Skeleton className="h-9 w-full max-w-md" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-64 w-full min-w-0" />
          </div>
        </div>
      }
    >
      <WorkflowRunHubClientInner {...props} />
    </React.Suspense>
  )
}
