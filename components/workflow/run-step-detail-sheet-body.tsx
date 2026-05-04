"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { NodeResult } from "@/lib/workflow/types"
import { stringifyRunJsonPayload } from "@/lib/workflow/run-results"
import { displayRunDuration, formatRunLocalDate } from "@/lib/workflow/run-formatting"

export interface RunStepDetailSheetBodyProps {
  /** Short display name shown in header and metadata. */
  stepLabel: string
  /** Persisted step row including optional `input` / `output` snapshots. */
  result: NodeResult
  /** Parent workflow run id (shown as runId in metadata). */
  runId: string
}

/**
 * Light-mode-forward layout for inspecting one step inside a slide-over: header row with duration,
 * metadata key-value card, collapsible blocks for JSON payloads.
 */
export function RunStepDetailSheetBody({ stepLabel, result, runId }: RunStepDetailSheetBodyProps) {
  const durationMs = stepWallMs(result)
  const durationLabel =
    durationMs != null ? displayRunDuration(durationMs) : displayRunDuration(null)

  const inputCaptured = Object.prototype.hasOwnProperty.call(result, "input")
  const outputCaptured = Object.prototype.hasOwnProperty.call(result, "output")

  const [inputOpen, setInputOpen] = React.useState(false)
  const [outputOpen, setOutputOpen] = React.useState(false)

  /** Light “admin shell”: white cards + slate-ish borders that still respect dark theme. */
  const cardOuter = cn(
    "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm divide-y divide-slate-200",
    "dark:border-border dark:bg-card dark:divide-border"
  )

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {/* Chrome — title left, duration capsule + divider beside the sheet close control */}
      <div
        className={cn(
          "shrink-0 border-b border-slate-200 bg-slate-50/90 px-4 py-3.5 dark:border-border dark:bg-muted/40"
        )}
      >
        <div className="flex items-start justify-between gap-4 pr-8">
          <h2 className="min-w-0 flex-1 text-base font-semibold leading-snug text-slate-900 dark:text-foreground truncate">
            {stepLabel || result.node_id}
          </h2>
          {/* Duration + divider — mirrors Vercel run step chrome */}
          <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
            <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs tabular-nums text-slate-800 shadow-sm dark:border-border dark:bg-background dark:text-foreground">
              {durationLabel}
            </span>
            <span className="text-slate-300 select-none dark:text-border" aria-hidden>
              {"|"}
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-white px-4 py-4 dark:bg-popover">
        {/* Step error (if any) — above metadata so it is not missed */}
        {result.error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-900 whitespace-pre-wrap break-words dark:border-red-900/55 dark:bg-red-950/40 dark:text-red-50">
            {result.error}
          </div>
        ) : null}

        {/* Key / value card — labels muted, ids monospaced */}
        <div className={cardOuter}>
          <MetaRow label="stepName" value={stepLabel || result.node_id} />
          <MetaRow label="status" value={<span>{humaniseStepStatus(result.status)}</span>} />
          <MetaRow label="stepId" value={result.node_id} mono />
          <MetaRow label="runId" value={runId} mono />
          {result.started_at ? (
            <MetaRow label="startedAt" value={formatRunLocalDate(result.started_at)} />
          ) : null}
          {result.completed_at ? (
            <MetaRow label="completedAt" value={formatRunLocalDate(result.completed_at)} />
          ) : null}
        </div>

        {/* Lowercase section labels + bordered accordions */}
        <div className="space-y-5">
          <section className="space-y-1.5">
            <p className="px-0.5 text-[11px] font-medium lowercase tracking-wide text-slate-500 dark:text-muted-foreground">
              input
            </p>
            <div className={cardOuter}>
              <IoCollapsible
                open={inputOpen}
                onOpenChange={setInputOpen}
                summary={argumentSummaryPhrase("Input", inputCaptured, result.input)}
                captured={inputCaptured}
                payload={result.input}
              />
            </div>
          </section>

          <section className="space-y-1.5">
            <p className="px-0.5 text-[11px] font-medium lowercase tracking-wide text-slate-500 dark:text-muted-foreground">
              output
            </p>
            <div className={cardOuter}>
              <IoCollapsible
                open={outputOpen}
                onOpenChange={setOutputOpen}
                summary={argumentSummaryPhrase("Output", outputCaptured, result.output)}
                captured={outputCaptured}
                payload={result.output}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/** One row in the metadata table — label left, value right. */
function MetaRow(p: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-8 px-3.5 py-2.5 text-sm leading-snug">
      <span className="min-w-[5.5rem] shrink-0 text-xs font-normal text-slate-500 dark:text-muted-foreground">
        {p.label}
      </span>
      <div
        className={cn(
          "min-w-0 flex-1 text-right text-sm text-slate-900 dark:text-foreground wrap-break-word",
          p.mono && "font-mono text-[13px] tracking-tight"
        )}
      >
        {p.value}
      </div>
    </div>
  )
}

/** Collapsible JSON block with chevron disclosure and argument count in the summary line. */
function IoCollapsible(p: {
  open: boolean
  onOpenChange: (next: boolean) => void
  summary: string
  captured: boolean
  payload: unknown
}) {
  return (
    <Collapsible open={p.open} onOpenChange={p.onOpenChange}>
      {/* Disclosure row */}
      <CollapsibleTrigger
        type="button"
        className={cn(
          "flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50",
          "dark:hover:bg-muted/50"
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-slate-500 transition-transform duration-150 dark:text-muted-foreground",
            p.open ? "rotate-90" : "rotate-0"
          )}
        />
        <span className="text-sm font-medium text-slate-800 dark:text-foreground">{p.summary}</span>
      </CollapsibleTrigger>

      {/* JSON body */}
      <CollapsibleContent>
        <div className="border-t border-slate-200 bg-slate-50/70 px-3.5 py-3 dark:border-border dark:bg-muted/25">
          {p.captured ? (
            <pre className="max-h-[40vh] overflow-auto rounded-md border border-slate-200/90 bg-white p-3 font-mono text-[11px] leading-snug whitespace-pre-wrap break-all text-slate-800 dark:border-border dark:bg-background dark:text-foreground">
              {stringifyRunJsonPayload(p.payload)}
            </pre>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Not recorded for this run (created before step I/O was persisted).
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Maps persisted status to Vercel-flavoured copy (e.g. success → completed). */
function humaniseStepStatus(status: NodeResult["status"]) {
  if (status === "success") return "completed"
  if (status === "pending") return "pending"
  if (status === "running") return "running"
  if (status === "failed") return "failed"
  if (status === "skipped") return "skipped"
  return status
}

/** Computes step wall time from timestamps when both are present. */
function stepWallMs(nr: NodeResult): number | null {
  const a = nr.started_at ? Date.parse(nr.started_at) : NaN
  const b = nr.completed_at ? Date.parse(nr.completed_at) : NaN
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return b - a
}

/** Builds the “Input (n arguments)” style summary for the disclosure row. */
function argumentSummaryPhrase(name: string, captured: boolean, payload: unknown) {
  if (!captured) {
    return `${name} (not recorded)`
  }
  const n = countPayloadEntries(payload)
  const word = n === 1 ? "argument" : "arguments"
  return `${name} (${n} ${word})`
}

/** Counts roots for objects/arrays, otherwise treat as a single scalar slot. */
function countPayloadEntries(payload: unknown) {
  if (payload === null || payload === undefined) return 0
  if (Array.isArray(payload)) return payload.length
  if (typeof payload === "object") return Object.keys(payload as object).length
  return 1
}
