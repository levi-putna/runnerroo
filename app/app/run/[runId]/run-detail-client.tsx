"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChevronRight, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { WorkflowRunDetail } from "@/lib/workflows/queries/run-queries"
import type { WorkflowApprovalListRow } from "@/lib/workflows/queries/approval-queries"
import { RunStatusGlyph } from "@/components/workflow/run-status-glyph"
import { RunStepDetailSheetBody } from "@/components/workflow/run-step-detail-sheet-body"
import { RunExecutionOverview } from "@/components/workflow/run-execution-overview"
import { WorkflowApprovalDialog } from "@/components/workflow/workflow-approval-dialog"
import { normaliseWorkflowRunNodeResults, stringifyRunJsonPayload } from "@/lib/workflows/engine/run-results"
import {
  displayRunDuration,
  formatRunLocalDate,
  runPersistedLifecycleLabel,
} from "@/lib/workflows/engine/run-formatting"
import { buildRunTimelineSteps, resolveRunStepTimelineLabel, shortRunIdForDisplay } from "@/lib/workflows/engine/run-timeline"
import type { Json } from "@/types/database"

export interface WorkflowRunDetailClientProps {
  run: WorkflowRunDetail
}

/**
 * Read-only detail view for a single persisted run: trigger payload, errors, and per-node results.
 * While the persisted run status is `"running"` or `"waiting_approval"`, polls `/api/run/[runId]` every 5 seconds until the status changes.
 */
export function WorkflowRunDetailClient({ run }: WorkflowRunDetailClientProps) {
  const [liveRun, setLiveRun] = useState(run)

  useEffect(() => {
    setLiveRun(run)
  }, [run])

  useEffect(() => {
    if (liveRun.status !== "running" && liveRun.status !== "waiting_approval") return

    let cancelled = false

    /**
     * Fetches the latest run row from the API and merges it into local state (no `data` wrapper).
     */
    const poll = async () => {
      if (cancelled) return
      try {
        const response = await fetch(`/api/run/${liveRun.id}`, { cache: "no-store" })
        if (!response.ok || cancelled) return
        const body = (await response.json()) as { run?: WorkflowRunDetail }
        const next = body.run
        if (next && !cancelled) {
          setLiveRun(next)
        }
      } catch {
        // Next interval retries
      }
    }

    void poll()
    const intervalId = window.setInterval(poll, 5000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [liveRun.id, liveRun.status])

  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [pendingApproval, setPendingApproval] = useState<WorkflowApprovalListRow | null>(null)
  const [approvalFetchError, setApprovalFetchError] = useState<string | null>(null)
  const [approvalFetching, setApprovalFetching] = useState(false)
  const [approvalBusy, setApprovalBusy] = useState<{ id: string; action: "approved" | "declined" } | null>(null)

  useEffect(() => {
    if (liveRun.status !== "waiting_approval") {
      setApprovalDialogOpen(false)
    }
  }, [liveRun.status])

  useEffect(() => {
    if (liveRun.status !== "waiting_approval") {
      setPendingApproval(null)
      setApprovalFetchError(null)
      setApprovalFetching(false)
      return
    }

    let cancelled = false

    /**
     * Loads the pending approval row for this run (if any) for the signed-in owner.
     */
    const load = async () => {
      setApprovalFetching(true)
      setApprovalFetchError(null)
      try {
        const response = await fetch(
          `/api/approvals?workflow_run_id=${encodeURIComponent(liveRun.id)}`,
          { cache: "no-store" },
        )
        const body = (await response.json().catch(() => ({}))) as {
          approvals?: WorkflowApprovalListRow[]
          error?: string
        }
        if (cancelled) return
        if (!response.ok) {
          setApprovalFetchError(typeof body.error === "string" ? body.error : "Could not load approval.")
          setPendingApproval(null)
          return
        }
        const list = Array.isArray(body.approvals) ? body.approvals : []
        setPendingApproval(list[0] ?? null)
      } finally {
        if (!cancelled) setApprovalFetching(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [liveRun.id, liveRun.status])

  /**
   * Posts approve/decline, then refreshes the run row from the API.
   */
  async function respondToApproval(p: { approvalId: string; decision: "approved" | "declined" }) {
    const { approvalId, decision } = p
    setApprovalBusy({ id: approvalId, action: decision })
    setApprovalFetchError(null)
    try {
      const response = await fetch(`/api/approvals/${approvalId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setApprovalFetchError(typeof body.error === "string" ? body.error : "Request failed")
        return
      }
      setApprovalDialogOpen(false)
      setPendingApproval(null)
      const runRes = await fetch(`/api/run/${liveRun.id}`, { cache: "no-store" })
      if (runRes.ok) {
        const runBody = (await runRes.json()) as { run?: WorkflowRunDetail }
        if (runBody.run) setLiveRun(runBody.run)
      }
    } finally {
      setApprovalBusy(null)
    }
  }

  const nodeResults = useMemo(
    () => normaliseWorkflowRunNodeResults({ value: liveRun.node_results }),
    [liveRun.node_results]
  )
  const workflowName = liveRun.workflows?.name?.trim() || "Untitled workflow"
  const workflowId = liveRun.workflow_id

  const timeline = useMemo(
    () =>
      buildRunTimelineSteps({
        runStartedAt: liveRun.started_at,
        runCompletedAt: liveRun.completed_at,
        runDurationMs: liveRun.duration_ms,
        nodeResults,
      }),
    [liveRun.completed_at, liveRun.duration_ms, liveRun.started_at, nodeResults]
  )

  const [stepSheetOpen, setStepSheetOpen] = useState(false)
  const [sheetStepKey, setSheetStepKey] = useState<string | null>(null)

  const sheetStepResult = useMemo(() => {
    if (!sheetStepKey) return null
    return timeline.steps.find((step) => step.reactKey === sheetStepKey)?.result ?? null
  }, [sheetStepKey, timeline.steps])

  const sheetStepLabel = sheetStepResult ? resolveRunStepTimelineLabel(sheetStepResult) : ""

  const runHeaderId = (liveRun.wdk_run_id && liveRun.wdk_run_id.trim()) || shortRunIdForDisplay(liveRun.id)
  const canOpenApprovalDialog = pendingApproval !== null && approvalBusy === null
  const reviewApprovalButtonLabel = approvalFetching ? "Loading approval..." : "Review approval"

  return (
    <div className="flex min-h-[calc(100vh-112px)] w-full flex-col bg-background">
      {/* Project-style header — breadcrumbs, title, secondary actions */}
      <div className="shrink-0 border-b border-border/80 bg-muted/15 px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground"
          >
            <Link
              href="/app/workflows"
              className="font-medium underline-offset-4 hover:text-foreground hover:underline"
            >
              Workflows
            </Link>
            {/* Trail */}
            <ChevronRight aria-hidden className="size-3 shrink-0 opacity-50" />
            <Link
              href="/app/run"
              className="font-medium underline-offset-4 hover:text-foreground hover:underline"
            >
              Runs
            </Link>
            <ChevronRight aria-hidden className="size-3 shrink-0 opacity-50" />
            <span className="truncate font-mono text-[11px] font-medium text-foreground">
              {runHeaderId}
            </span>
          </nav>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              {/* Primary title — workflow context */}
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{workflowName}</h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Execution detail for this run. Inspect the timeline, open a step for payloads, and review
                  trigger inputs below.
                </p>
              </div>

              {/* Status row */}
              <div className="flex flex-wrap items-center gap-2 gap-y-2">
                <RunStatusGlyph status={liveRun.status} className="size-4" />
                <span className="text-sm font-medium">{runPersistedLifecycleLabel(liveRun.status)}</span>
                <Badge variant="outline" className="font-normal uppercase">
                  {liveRun.trigger_type}
                </Badge>
              </div>

              {/* Meta line — timestamps + duration (dense, tabular) */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
                <span>Started {formatRunLocalDate(liveRun.started_at)}</span>
                {liveRun.completed_at ? (
                  <>
                    <span aria-hidden className="text-muted-foreground/40 select-none">
                      {"\u00B7"}
                    </span>
                    <span>Completed {formatRunLocalDate(liveRun.completed_at)}</span>
                  </>
                ) : null}
                <span aria-hidden className="text-muted-foreground/40 select-none">
                  {"\u00B7"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock aria-hidden className="size-3.5 shrink-0" />
                  {displayRunDuration(liveRun.duration_ms)}
                </span>
              </div>
            </div>

            {/* Secondary actions — outline buttons like console toolbars */}
            <div className="flex shrink-0 flex-wrap gap-2">
              {liveRun.status === "waiting_approval" ? (
                <Button type="button" size="sm" className="h-9" onClick={() => setApprovalDialogOpen(true)}>
                  Review approval
                </Button>
              ) : null}
              <Link
                href={`/app/workflows/${workflowId}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}
              >
                Workflow editor
              </Link>
              <Link
                href={`/app/workflows/${workflowId}/history`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}
              >
                Workflow history
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full flex-1 space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        {/* Waiting-for-approval callout with primary action */}
        {liveRun.status === "waiting_approval" ? (
          <section className="rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-4 dark:border-violet-900/60 dark:bg-violet-950/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-100">Approval required</h2>
                <p className="text-sm text-violet-800/90 dark:text-violet-200/90">
                  This run is paused until you approve or decline the current approval step.
                </p>
                {approvalFetchError ? (
                  <p className="text-xs text-red-700 dark:text-red-300">{approvalFetchError}</p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                className="h-9 shrink-0"
                disabled={!canOpenApprovalDialog}
                onClick={() => setApprovalDialogOpen(true)}
              >
                {reviewApprovalButtonLabel}
              </Button>
            </div>
          </section>
        ) : null}

        {/* Timeline + overview card */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Execution timeline
          </h2>
          <RunExecutionOverview
            status={liveRun.status}
            runId={liveRun.id}
            wdkRunId={liveRun.wdk_run_id}
            durationMs={liveRun.duration_ms}
            timelineTotalMs={timeline.timelineTotalMs}
            steps={timeline.steps}
            selectedReactKey={stepSheetOpen ? sheetStepKey : null}
            onSelectStep={({ reactKey }) => {
              setSheetStepKey(reactKey)
              setStepSheetOpen(true)
            }}
          />
        </section>

        {/* Global error */}
        {liveRun.error?.trim() ? (
          <section className="space-y-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
              Run error
            </h2>
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-50">
              <p className="whitespace-pre-wrap wrap-break-word">{liveRun.error}</p>
            </div>
          </section>
        ) : null}

        {/* Trigger payload */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Trigger inputs
          </h2>
          <TriggerInputsBlock value={liveRun.trigger_inputs} />
        </section>
      </div>

      {/* Step I/O slides in from the edge when you pick a timeline row */}
      <Sheet open={stepSheetOpen} onOpenChange={setStepSheetOpen}>
        <SheetContent
          side="right"
          className="flex h-full max-h-[100dvh] w-full flex-col gap-0 overflow-hidden border-l border-slate-200 bg-white p-0 sm:max-w-lg dark:border-border dark:bg-popover"
        >
          {sheetStepResult ? (
            <>
              <SheetTitle className="sr-only">{sheetStepLabel}</SheetTitle>
              <SheetDescription className="sr-only">
                Step metadata and stored input and output for this workflow step.
              </SheetDescription>
              <RunStepDetailSheetBody
                stepLabel={sheetStepLabel}
                result={sheetStepResult}
                runId={liveRun.id}
              />
            </>
          ) : (
            <div className="p-6">
              <SheetTitle>Step</SheetTitle>
              <SheetDescription className="mt-1">No step selected.</SheetDescription>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <WorkflowApprovalDialog
        open={approvalDialogOpen}
        onOpenChange={({ open }) => {
          setApprovalDialogOpen(open)
          if (!open) setApprovalFetchError(null)
        }}
        approval={pendingApproval}
        isLoading={approvalDialogOpen && approvalFetching && pendingApproval === null && approvalFetchError === null}
        loadError={approvalFetchError}
        busyRow={approvalBusy}
        onRespond={(p) => void respondToApproval(p)}
      />
    </div>
  )
}

function TriggerInputsBlock({ value }: { value: Json | null }) {
  if (value === null || value === undefined) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-sm italic text-muted-foreground">
        No trigger inputs were stored for this run (older rows or non-manual triggers).
      </p>
    )
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-muted-foreground shadow-sm dark:border-border dark:bg-card">
        Empty payload.
      </div>
    )
  }
  return (
    <pre className="overflow-x-auto wrap-break-word whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-mono text-[12px] leading-relaxed text-slate-900 shadow-sm dark:border-border dark:bg-card dark:text-foreground">
      {stringifyRunJsonPayload(value)}
    </pre>
  )
}
