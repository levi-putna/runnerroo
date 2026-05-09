"use client"

import type { CSSProperties } from "react"
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { displayRunDuration } from "@/lib/workflows/engine/run-formatting"
import type { ParsedRunTimelineStep } from "@/lib/workflows/engine/run-timeline"
import {
  buildRunTimelineDisplayLayout,
  buildRunTimelineTickMarks,
  shortRunIdForDisplay,
} from "@/lib/workflows/engine/run-timeline"
import { FormattedDurationSeconds } from "@/components/formatted-duration-seconds"
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
 * Optionally compresses long steps (over 60 seconds wall time by default) so shorter steps stay visible.
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
  const [compressLongSteps, setCompressLongSteps] = useState(true)
  const safeTotal = Math.max(1, timelineTotalMs)
  const { rows: timelineRows, compressRegionsDisplay } = useMemo(
    () =>
      buildRunTimelineDisplayLayout({
        timelineTotalMs,
        steps,
        compressLongSteps,
      }),
    [compressLongSteps, timelineTotalMs, steps]
  )
  const timelineTickMarks = useMemo(
    () =>
      buildRunTimelineTickMarks({
        timelineTotalMs,
        steps,
        compressLongSteps,
      }),
    [compressLongSteps, timelineTotalMs, steps]
  )
  const runIdLine = (wdkRunId && wdkRunId.trim()) || shortRunIdForDisplay(runId)
  const durationHeadline = useMemo(() => {
    if (status === "waiting_approval") {
      return "Paused for approval…" as const
    }

    const ms = durationMs ?? (status === "running" ? null : safeTotal)
    if (ms == null) {
      return "Running…" as const
    }
    return ms / 1000
  }, [durationMs, safeTotal, status])

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
          <p className="font-mono text-sm font-semibold tabular-nums">
            {typeof durationHeadline === "number" ? (
              <FormattedDurationSeconds seconds={durationHeadline} />
            ) : (
              durationHeadline
            )}
          </p>
        </div>
      </div>

      {/* Waterfall timeline */}
      <div className="p-4 space-y-3">
        {/* Toolbar — timeline truncation toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Execution</p>
          <div className="flex items-center gap-2">
            <Label htmlFor="timeline-compress-long-steps" className="cursor-pointer text-[11px] font-normal text-muted-foreground">
              Compress long steps
            </Label>
            <Switch
              id="timeline-compress-long-steps"
              size="sm"
              checked={compressLongSteps}
              onCheckedChange={(checked) => {
                setCompressLongSteps(checked)
              }}
            />
          </div>
        </div>

        <div className="relative min-w-0 overflow-hidden rounded-lg border border-border/50 bg-muted/20 px-2 pb-3 pt-2">
          {/* Time ruler — wall times placed with the same scaled axis as bars (middles of long steps are visually shortened when compression is on) */}
          <div
            className="relative z-[1] mb-1 h-7 min-w-0"
            aria-hidden
            title={
              compressRegionsDisplay.length > 0
                ? "Ruler uses the same shortened scale as the bars: middles of long steps are visually compressed."
                : undefined
            }
          >
            {timelineTickMarks.map((tick, tickIdx) => (
              <span
                key={`tick-${tickIdx}`}
                className={cn(
                  "absolute top-0 max-w-[min(7.5rem,22%)] truncate font-mono text-[10px] tabular-nums text-muted-foreground",
                  timelineTickLabelAlignClass(tickIdx, timelineTickMarks.length)
                )}
                style={timelineTickLabelPositionStyle(tickIdx, timelineTickMarks.length, tick.pctAlongDisplay)}
              >
                {tick.wallMs <= 0 ? "0" : displayRunDuration(tick.wallMs)}
              </span>
            ))}
          </div>

          {/* Vertical grid — aligned to tick positions, spans step rows only */}
          <div aria-hidden className="pointer-events-none absolute inset-x-2 bottom-2 top-9">
            {timelineTickMarks.map((tick, tickIdx) => (
              <div
                key={`line-${tickIdx}`}
                className="pointer-events-none absolute bottom-0 top-0 w-px bg-border/45"
                style={timelineTickLinePositionStyle(tickIdx, timelineTickMarks.length, tick.pctAlongDisplay)}
              />
            ))}
          </div>

          <div className="relative z-[1] min-w-0 space-y-2">
            {/* Parent workflow span — same display axis as steps; cuts align with truncated step interiors */}
            <div className="relative h-9 w-full min-w-0">
              <div
                className={cn(
                  "absolute inset-0 flex items-center rounded-md border px-2.5 font-mono text-[11px] sm:text-xs",
                  "border-sky-400/55 bg-sky-500/10 text-sky-900 dark:border-sky-500/45 dark:bg-sky-500/15 dark:text-sky-100"
                )}
                aria-hidden
              />
              {compressRegionsDisplay.map((region, regionIdx) => {
                // Same fixed width as step-row cuts; centre on the compressed display interval (not full pctWidth).
                const centrePct = region.pctLeft + region.pctWidth / 2
                return (
                  <div
                    key={regionIdx}
                    className="pointer-events-none absolute inset-y-0 z-[1] -translate-x-1/2"
                    style={{
                      left: `${centrePct}%`,
                      width: TIMELINE_COMPRESSION_GAP_PX,
                    }}
                  >
                    <TimelineZigzagCut
                      borderStrokeClass={WORKFLOW_BAR_ZIGZAG_STROKE_CLASS}
                      className="h-full min-h-0"
                      omittedWallMs={region.omittedWallMs}
                      stepDurationMs={safeTotal}
                    />
                  </div>
                )
              })}
              <div className="relative z-[2] flex h-9 w-full min-w-0 items-center justify-between px-2.5 font-mono text-[11px] sm:text-xs text-sky-900 dark:text-sky-100">
                <span className="truncate pr-2">workflow()</span>
                <span className="min-w-0 shrink truncate text-right tabular-nums text-sky-800/90 dark:text-sky-100/90">
                  {typeof durationHeadline === "number" ? (
                    <FormattedDurationSeconds seconds={durationHeadline} />
                  ) : (
                    durationHeadline
                  )}
                </span>
              </div>
            </div>

            {/* Per-step bars — horizontal % use a display time axis when compression is on. */}
            {steps.length === 0 ? (
              <p className="relative text-sm text-muted-foreground italic pl-1">
                No steps were recorded for this run.
              </p>
            ) : (
              timelineRows.map((row) => {
                const { step, pctStart, pctWidth, compression } = row

                return (
                  <div key={step.reactKey} className="relative h-8 w-full min-w-0">
                    {step.hasTimelineBar ? (
                      <button
                        type="button"
                        aria-pressed={selectedReactKey === step.reactKey}
                        aria-label={
                          compression
                            ? `${step.label}: ${displayRunDuration(step.durationMs)} total; middle of long step compressed on timeline (${displayRunDuration(compression.omittedWallMs)} omitted visually)`
                            : undefined
                        }
                        onClick={() => onSelectStep({ reactKey: step.reactKey })}
                        className={cn(
                          "absolute top-1/2 max-w-[calc(100%-4px)] -translate-y-1/2 font-mono text-[10px] leading-none sm:text-[11px]",
                          "flex min-w-0 flex-row items-stretch overflow-hidden p-0 text-left",
                          compression
                            ? "h-7 border-0 bg-transparent shadow-none transition-[transform,box-shadow] active:scale-[0.99] hover:brightness-100"
                            : "h-7 flex-col justify-center gap-0.5 rounded-md border px-2 transition-[box-shadow,transform] hover:brightness-[1.02] active:scale-[0.99]",
                          !compression && stepBarVisualClass(step.status),
                          selectedReactKey === step.reactKey &&
                            "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        )}
                        style={{
                          left: `${pctStart}%`,
                          width: `${pctWidth}%`,
                        }}
                      >
                        {compression ? (
                          <>
                            {/* Start segment — label (step colour only on this side of the cut) */}
                            <span
                              className={cn(
                                "flex min-h-0 min-w-0 flex-col justify-center gap-0.5 rounded-l-md rounded-r-none border border-r-0 px-2 py-0.5 pr-1.5",
                                "transition-[filter] hover:brightness-[1.02]",
                                stepBarVisualClass(step.status)
                              )}
                              style={{ flex: `${compression.leftFlex} 1 0%` }}
                            >
                              <span className="truncate">{step.label}</span>
                            </span>
                            {/* Middle — fixed-width track-coloured gap with zigzag “paper tear” (no step fill) */}
                            <TimelineZigzagCut
                              omittedWallMs={compression.omittedWallMs}
                              status={step.status}
                              stepDurationMs={step.durationMs}
                            />
                            {/* End segment — duration (step colour only on this side of the cut) */}
                            <span
                              className={cn(
                                "flex min-w-0 flex-col justify-center rounded-l-none rounded-r-md border border-l-0 px-2 py-0.5 pl-1.5 text-right",
                                "transition-[filter] hover:brightness-[1.02]",
                                stepBarVisualClass(step.status)
                              )}
                              style={{ flex: `${compression.rightFlex} 1 0%` }}
                            >
                              <span className="tabular-nums opacity-90">
                                {displayRunDuration(step.durationMs)}
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="truncate">{step.label}</span>
                            <span className="tabular-nums opacity-90">
                              {displayRunDuration(step.durationMs)}
                            </span>
                          </>
                        )}
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

/**
 * Text alignment for tick captions so truncation favours readability at the extremes of the ruler.
 */
function timelineTickLabelAlignClass(index: number, total: number): string {
  if (total <= 1) return "text-left"
  if (index === 0) return "text-left"
  if (index === total - 1) return "text-right"
  return "text-center"
}

/**
 * Places ruler labels flush at the edges and centred elsewhere to avoid clipping outside the padded card.
 */
function timelineTickLabelPositionStyle(
  index: number,
  total: number,
  pctAlongDisplay: number
): CSSProperties {
  if (total <= 1) return { left: "0%" }
  if (index === 0) return { left: "0%" }
  if (index === total - 1) return { left: "100%", transform: "translateX(-100%)" }
  return { left: `${pctAlongDisplay}%`, transform: "translateX(-50%)" }
}

/**
 * Positions faint vertical markers on the same percentage axis as labels and step bars.
 */
function timelineTickLinePositionStyle(
  index: number,
  total: number,
  pctAlongDisplay: number
): CSSProperties {
  return timelineTickLabelPositionStyle(index, total, pctAlongDisplay)
}

/** Matches the workflow summary bar border tint so cuts read as part of the same rail. */
const WORKFLOW_BAR_ZIGZAG_STROKE_CLASS = "stroke-sky-500/50"

/** Fixed physical width so summary-row cuts match per-step tears (display % width would look huge). */
const TIMELINE_COMPRESSION_GAP_PX = 28

/**
 * Track-coloured gap with edge-aligned zigzag strokes matching the step or workflow border.
 */
function TimelineZigzagCut({
  omittedWallMs,
  stepDurationMs,
  status,
  borderStrokeClass,
  className,
}: {
  omittedWallMs: number
  stepDurationMs: number
  status?: ParsedRunTimelineStep["status"]
  borderStrokeClass?: string
  /** Merged onto the outer gap strip (e.g. `h-full` for the workflow summary row). */
  className?: string
}) {
  const title = `Timeline shortened: ${displayRunDuration(omittedWallMs)} of wall time is omitted in this gap. Reference span: ${displayRunDuration(stepDurationMs)}.`

  const w = TIMELINE_COMPRESSION_GAP_PX
  const strokeClass =
    borderStrokeClass ?? (status != null ? stepBarZigzagBorderStrokeClass(status) : WORKFLOW_BAR_ZIGZAG_STROKE_CLASS)

  return (
    <span
      className={cn(
        "relative flex min-h-7 shrink-0 items-center justify-center bg-muted/95",
        "border-x border-dashed border-border/90 dark:border-border/95",
        className
      )}
      style={{
        width: w,
        minWidth: w,
        maxWidth: w,
      }}
      role="img"
      title={title}
      aria-label={`Timeline cut: ${displayRunDuration(omittedWallMs)} of wall time omitted in this gap.`}
    >
      {/* Left and right edges match x=0 / x=w so fill runs flush to the tear; stroke matches bar border tokens */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full [stroke-linecap:butt] [stroke-linejoin:miter]"
        preserveAspectRatio="none"
        viewBox={`0 0 ${w} 100`}
      >
        <path
          className={strokeClass}
          d="M 0 0 L 3.25 10 L 0 20 L 3.25 30 L 0 40 L 3.25 50 L 0 60 L 3.25 70 L 0 80 L 3.25 90 L 0 100"
          fill="none"
          strokeWidth="1.35"
          vectorEffect="nonScalingStroke"
        />
        <path
          className={strokeClass}
          d={`M ${w} 0 L ${w - 3.25} 10 L ${w} 20 L ${w - 3.25} 30 L ${w} 40 L ${w - 3.25} 50 L ${w} 60 L ${w - 3.25} 70 L ${w} 80 L ${w - 3.25} 90 L ${w} 100`}
          fill="none"
          strokeWidth="1.35"
          vectorEffect="nonScalingStroke"
        />
      </svg>
      {/* Centre cue — omitted time (decorative; label comes from aria-label on parent). */}
      <span
        aria-hidden
        className="relative z-[1] select-none text-[10px] font-semibold leading-none tracking-wide text-foreground/45"
      >
        {"\u2026"}
      </span>
    </span>
  )
}

/**
 * Stroke utilities aligned with `stepBarVisualClass` border hues so the tear reads as part of the bar edge.
 */
function stepBarZigzagBorderStrokeClass(status: ParsedRunTimelineStep["status"]) {
  if (status === "success") return "stroke-emerald-500/45"
  if (status === "failed") return "stroke-rose-500/55"
  if (status === "running") return "stroke-amber-500/50"
  if (status === "awaiting_approval") return "stroke-violet-500/50"
  if (status === "skipped") return "stroke-muted-foreground/35"
  return "stroke-border/70"
}

function runStatusLabel(status: RunStatus) {
  if (status === "success") return "Completed"
  if (status === "failed") return "Failed"
  if (status === "cancelled") return "Cancelled"
  if (status === "waiting_approval") return "Awaiting approval"
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
  if (status === "awaiting_approval") {
    return "border-violet-500/50 bg-violet-500/12 text-violet-950 dark:text-violet-50"
  }
  if (status === "skipped") {
    return "border-muted-foreground/35 bg-muted/50 text-muted-foreground"
  }
  return "border-border/70 bg-muted/40 text-foreground"
}
