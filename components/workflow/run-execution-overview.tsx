"use client"

import { cn } from "@/lib/utils"
import { displayRunDuration } from "@/lib/workflow/run-formatting"
import type { ParsedRunTimelineStep } from "@/lib/workflow/run-timeline"
import { shortRunIdForDisplay } from "@/lib/workflow/run-timeline"
import { RunStatusGlyph } from "@/components/workflow/run-status-glyph"
import type { Database } from "@/types/database"

type RunStatus = Database["public"]["Tables"]["workflow_runs"]["Row"]["status"]

export interface RunExecutionOverviewProps {
  status: RunStatus
  /** Primary row id (UUID). */
  runId: string
  /** Vercel Workflow run id when available (e.g. `wrun_…`). */
  wdkRunId?: string | null
  durationMs: number | null
  /** Denominator for horizontal layout (usually wall-clock span of the run). */
  timelineTotalMs: number
  steps: ParsedRunTimelineStep[]
  selectedReactKey: string | null
  onSelectStep: (p: { reactKey: string }) => void
}

/**
 * Summary header plus a waterfall / Gantt-style step timeline inspired by Vercel workflow run observability.
 */
export function RunExecutionOverview({
  status,
  runId,
  wdkRunId,
  durationMs,
  timelineTotalMs,
  steps,
  selectedReactKey,
  onSelectStep,
}: RunExecutionOverviewProps) {
  const safeTotal = Math.max(1, timelineTotalMs)
  const runIdLine = (wdkRunId && wdkRunId.trim()) || shortRunIdForDisplay(runId)
  const durationLabel = displayRunDuration(durationMs ?? (status === "running" ? null : safeTotal))

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
      {/* High-level metadata — Status / Run id / Duration */}
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3 sm:items-start border-b border-border/60">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
          <div className="flex items-center gap-2">
            <RunStatusGlyph status={status} className="size-4" />
            <span className="text-sm font-semibold tracking-tight">{runStatusLabel(status)}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Run ID</p>
          <p className="font-mono text-sm font-semibold tracking-tight break-all">{runIdLine}</p>
        </div>
        <div className="space-y-1 sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Duration</p>
          <p className="font-mono text-sm font-semibold tabular-nums">{durationLabel}</p>
        </div>
      </div>

      {/* Waterfall timeline */}
      <div className="p-4 space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Execution
        </p>

        <div className="relative rounded-lg border border-border/50 bg-muted/20 px-2 py-3">
          {/* Faint vertical time grid */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-3 inset-x-2 flex"
          >
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="flex-1 border-l border-border/40 first:border-l-0"
              />
            ))}
          </div>

          <div className="relative space-y-2">
            {/* Parent workflow span */}
            <div
              className={cn(
                "relative flex h-9 w-full items-center justify-between rounded-md border px-2.5 font-mono text-[11px] sm:text-xs",
                "border-sky-400/55 bg-sky-500/10 text-sky-900 dark:border-sky-500/45 dark:bg-sky-500/15 dark:text-sky-100"
              )}
            >
              <span className="truncate pr-2">workflow()</span>
              <span className="shrink-0 tabular-nums text-sky-800/90 dark:text-sky-100/90">
                {durationLabel}
              </span>
            </div>

            {/* Per-step bars */}
            {steps.length === 0 ? (
              <p className="relative text-sm text-muted-foreground italic pl-1">
                No steps were recorded for this run.
              </p>
            ) : (
              steps.map((step) => {
                const pctStartRaw = (step.startMs / safeTotal) * 100
                const pctStart = Math.min(100, Math.max(0, pctStartRaw))
                const pctWidthRaw =
                  step.hasTimelineBar ? (step.durationMs / safeTotal) * 100 : 0
                const pctWidthCap = Math.max(0, 100 - pctStart)
                const pctWidth = step.hasTimelineBar
                  ? Math.min(Math.max(pctWidthRaw, 0.45), pctWidthCap)
                  : 0

                return (
                  <div key={step.reactKey} className="relative h-8 w-full">
                    {step.hasTimelineBar ? (
                      <button
                        type="button"
                        aria-pressed={selectedReactKey === step.reactKey}
                        onClick={() => onSelectStep({ reactKey: step.reactKey })}
                        className={cn(
                          "absolute top-1/2 h-7 max-w-[calc(100%-4px)] -translate-y-1/2 rounded-md border px-2 text-left font-mono text-[10px] leading-none sm:text-[11px]",
                          "transition-[box-shadow,transform] hover:brightness-[1.02] active:scale-[0.99]",
                          "flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden",
                          stepBarVisualClass(step.status),
                          selectedReactKey === step.reactKey &&
                            "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        )}
                        style={{
                          left: `${pctStart}%`,
                          width: `${pctWidth}%`,
                        }}
                      >
                        <span className="truncate">{step.label}</span>
                        <span className="tabular-nums opacity-90">
                          {displayRunDuration(step.durationMs)}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-pressed={selectedReactKey === step.reactKey}
                        onClick={() => onSelectStep({ reactKey: step.reactKey })}
                        className={cn(
                          "relative z-[1] flex w-full items-center justify-between rounded-md border border-dashed border-border/80 bg-muted/30 px-2 py-1.5 text-left font-mono text-[10px] sm:text-[11px] text-muted-foreground",
                          selectedReactKey === step.reactKey &&
                            "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        )}
                      >
                        <span className="truncate pr-2">{step.label}</span>
                        <span className="shrink-0 italic tabular-nums">No timing</span>
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function runStatusLabel(status: RunStatus) {
  if (status === "success") return "Completed"
  if (status === "failed") return "Failed"
  if (status === "cancelled") return "Cancelled"
  return "Running"
}

function stepBarVisualClass(status: ParsedRunTimelineStep["status"]) {
  if (status === "success") {
    return "border-emerald-500/45 bg-emerald-500/12 text-emerald-950 dark:text-emerald-50"
  }
  if (status === "failed") {
    return "border-rose-500/55 bg-rose-500/12 text-rose-950 dark:text-rose-50"
  }
  if (status === "running") {
    return "border-amber-500/50 bg-amber-500/12 text-amber-950 dark:text-amber-50"
  }
  if (status === "skipped") {
    return "border-muted-foreground/35 bg-muted/50 text-muted-foreground"
  }
  return "border-border/70 bg-muted/40 text-foreground"
}
