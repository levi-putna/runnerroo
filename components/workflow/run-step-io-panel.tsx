"use client"

import type { NodeResult } from "@/lib/workflow/types"
import { stringifyRunJsonPayload } from "@/lib/workflow/run-results"
import { cn } from "@/lib/utils"

export interface RunStepIoPanelProps {
  /** Persisted step row from `node_results`. */
  result: NodeResult
  /** History drawer uses slightly smaller type. */
  compact?: boolean
}

/**
 * Displays stored input and output JSON for a single workflow step in run history UIs.
 */
export function RunStepIoPanel({ result, compact = false }: RunStepIoPanelProps) {
  const monoSize = compact ? "text-[11px]" : "text-[12px]"
  const heading = compact ? "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" : "text-xs font-semibold text-muted-foreground"

  const inputCaptured = Object.prototype.hasOwnProperty.call(result, "input")
  const outputCaptured = Object.prototype.hasOwnProperty.call(result, "output")

  return (
    <div className="space-y-2">
      {/* Inbound payload this step received */}
      <div>
        <p className={heading}>Input</p>
        {inputCaptured ? (
          <pre
            className={cn(
              "mt-1 rounded border border-border/50 bg-muted/25 p-2 font-mono leading-snug overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground",
              monoSize
            )}
          >
            {stringifyRunJsonPayload(result.input)}
          </pre>
        ) : (
          <p className={cn("mt-1 text-muted-foreground/80 italic", monoSize)}>
            Not recorded for this run (created before step I/O was persisted).
          </p>
        )}
      </div>

      {/* Outbound payload emitted to downstream steps */}
      <div>
        <p className={heading}>Output</p>
        {outputCaptured ? (
          <pre
            className={cn(
              "mt-1 rounded border border-border/50 bg-muted/25 p-2 font-mono leading-snug overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground",
              monoSize
            )}
          >
            {stringifyRunJsonPayload(result.output)}
          </pre>
        ) : (
          <p className={cn("mt-1 text-muted-foreground/80 italic", monoSize)}>
            Not recorded for this run (created before step I/O was persisted).
          </p>
        )}
      </div>
    </div>
  )
}
