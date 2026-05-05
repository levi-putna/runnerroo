"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { WorkflowRunDetail } from "@/lib/workflows/queries/run-queries"
import { RunStatusGlyph } from "@/components/workflow/run-status-glyph"
import { RunStepDetailSheetBody } from "@/components/workflow/run-step-detail-sheet-body"
import { RunExecutionOverview } from "@/components/workflow/run-execution-overview"
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
 */
export function WorkflowRunDetailClient({ run }: WorkflowRunDetailClientProps) {
  const nodeResults = useMemo(
    () => normaliseWorkflowRunNodeResults({ value: run.node_results }),
    [run.node_results]
  )
  const workflowName = run.workflows?.name?.trim() || "Untitled workflow"
  const workflowId = run.workflow_id

  const timeline = useMemo(
    () =>
      buildRunTimelineSteps({
        runStartedAt: run.started_at,
        runCompletedAt: run.completed_at,
        runDurationMs: run.duration_ms,
        nodeResults,
      }),
    [run.completed_at, run.duration_ms, run.started_at, nodeResults]
  )

  const [stepSheetOpen, setStepSheetOpen] = useState(false)
  const [sheetStepKey, setSheetStepKey] = useState<string | null>(null)

  const sheetStepResult = useMemo(() => {
    if (!sheetStepKey) return null
    return timeline.steps.find((step) => step.reactKey === sheetStepKey)?.result ?? null
  }, [sheetStepKey, timeline.steps])

  const sheetStepLabel = sheetStepResult ? resolveRunStepTimelineLabel(sheetStepResult) : ""

  const runHeaderId = (run.wdk_run_id && run.wdk_run_id.trim()) || shortRunIdForDisplay(run.id)

  return (
    <div className="flex min-h-[calc(100vh-112px)] flex-col bg-background">
      {/* Project-style header — breadcrumbs, title, secondary actions */}
      <div className="shrink-0 border-b border-border/80 bg-muted/15 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
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
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Execution detail for this run. Inspect the timeline, open a step for payloads, and review
                  trigger inputs below.
                </p>
              </div>

              {/* Status row */}
              <div className="flex flex-wrap items-center gap-2 gap-y-2">
                <RunStatusGlyph status={run.status} className="size-4" />
                <span className="text-sm font-medium">{runPersistedLifecycleLabel(run.status)}</span>
                <Badge variant="outline" className="font-normal uppercase">
                  {run.trigger_type}
                </Badge>
              </div>

              {/* Meta line — timestamps + duration (dense, tabular) */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
                <span>Started {formatRunLocalDate(run.started_at)}</span>
                {run.completed_at ? (
                  <>
                    <span aria-hidden className="text-muted-foreground/40 select-none">
                      {"\u00B7"}
                    </span>
                    <span>Completed {formatRunLocalDate(run.completed_at)}</span>
                  </>
                ) : null}
                <span aria-hidden className="text-muted-foreground/40 select-none">
                  {"\u00B7"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock aria-hidden className="size-3.5 shrink-0" />
                  {displayRunDuration(run.duration_ms)}
                </span>
              </div>
            </div>

            {/* Secondary actions — outline buttons like console toolbars */}
            <div className="flex shrink-0 flex-wrap gap-2">
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

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        {/* Timeline + overview card */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Execution timeline
          </h2>
          <RunExecutionOverview
            status={run.status}
            runId={run.id}
            wdkRunId={run.wdk_run_id}
            durationMs={run.duration_ms}
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
        {run.error?.trim() ? (
          <section className="space-y-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
              Run error
            </h2>
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-50">
              <p className="whitespace-pre-wrap wrap-break-word">{run.error}</p>
            </div>
          </section>
        ) : null}

        {/* Trigger payload */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Trigger inputs
          </h2>
          <TriggerInputsBlock value={run.trigger_inputs} />
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
                runId={run.id}
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
