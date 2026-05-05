"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { Database } from "@/types/database"
import { RunStatusGlyph } from "@/components/workflow/run-status-glyph"
import { RunStepIoPanel } from "@/components/workflow/run-step-io-panel"
import { normaliseWorkflowRunNodeResults } from "@/lib/workflows/engine/run-results"
import { displayRunDuration, formatRunLocalDate } from "@/lib/workflows/engine/run-formatting"
import { PageHeader } from "@/components/page-header"

type WorkflowRunRow = Database["public"]["Tables"]["workflow_runs"]["Row"]

export interface WorkflowRunHistoryClientProps {
  workflowId: string
  workflowName: string
  runs: WorkflowRunRow[]
}

/**
 * Shows prior executions for one workflow — compact status rows with expandable node-level results.
 */
export function WorkflowRunHistoryClient({
  workflowId,
  workflowName,
  runs,
}: WorkflowRunHistoryClientProps) {
  return (
    <div className="flex flex-col bg-background">
      {/* Heading / back */}
      <PageHeader title="Run history" description={workflowName}>
        <Link
          href={`/app/workflows/${workflowId}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
          )}
        >
          Back to editor
        </Link>
      </PageHeader>

      {/* Run list */}
      <div className="p-4 pb-12 space-y-2 max-w-3xl mx-auto w-full flex-1">
        {/* Empty state */}
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            No runs yet. Trigger a manual run from the workflow editor.
          </p>
        ) : (
          runs.map((run) => <RunHistoryRow key={run.id} run={run} />)
        )}
      </div>
    </div>
  )
}

interface RunHistoryRowProps {
  run: WorkflowRunRow
}

/**
 * Single run timeline entry with expandable node results JSON breakdown.
 */
function RunHistoryRow({ run }: RunHistoryRowProps) {
  const [open, setOpen] = React.useState(false)
  const nodeResults = normaliseWorkflowRunNodeResults({ value: run.node_results })

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {/* Summary row */}
      <div className="rounded-lg border bg-card px-3 py-2 shadow-sm flex flex-wrap items-center gap-2 gap-y-3">
        <CollapsibleTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "h-auto shrink-0 gap-1.5 p-2"
          )}
        >
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          {/* Status */}
          <RunStatusGlyph status={run.status} />
          <span className="sr-only">{run.status}</span>
        </CollapsibleTrigger>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-2 gap-y-2 min-w-[200px] flex-1 justify-between">
          <div className="flex flex-wrap items-center gap-2 gap-y-1 text-xs">
            <Badge variant="outline">{run.trigger_type}</Badge>
            <span className="text-muted-foreground tabular-nums">
              Started {formatRunLocalDate(run.started_at)}
            </span>
            {run.completed_at ? (
              <>
                <span aria-hidden className="text-muted-foreground/40 select-none">
                  {"\u00B7"}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  Completed {formatRunLocalDate(run.completed_at)}
                </span>
              </>
            ) : null}
            <span aria-hidden className="text-muted-foreground/40 select-none">
              {"\u00B7"}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              {displayRunDuration(run.duration_ms)}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/app/run/${run.id}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-7 text-xs"
              )}
            >
              Open run
            </Link>
            <code className="text-[11px] text-muted-foreground font-mono hidden sm:block truncate max-w-[14rem]">
              {run.id}
            </code>
          </div>
        </div>
      </div>

      {/* Per-node payloads */}
      <CollapsibleContent>
        <div className="mt-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs space-y-2">
          {/* Top-level failure */}
          {run.error?.trim() ? (
            <p className="text-red-700 dark:text-red-400 whitespace-pre-wrap break-words">{run.error}</p>
          ) : null}
          {/* Node results */}
          {nodeResults.length === 0 ? (
            <p className="text-muted-foreground italic">No node events recorded.</p>
          ) : (
            nodeResults.map((nr) => (
              <details key={`${run.id}:${nr.node_id}`} className="rounded-md border border-border/50 bg-background/80 px-2 py-1.5">
                <summary className="cursor-pointer flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
                  <Badge variant={nr.status === "failed" ? "destructive" : "secondary"} className="tabular-nums text-[10px]">
                    {nr.status}
                  </Badge>
                  <code className="font-mono text-[11px] truncate">{nr.node_id}</code>
                </summary>
                <div className="mt-2 space-y-2 pl-2 border-l-2 border-border/70">
                  {nr.error ? (
                    <p className="text-red-700 dark:text-red-400 whitespace-pre-wrap break-words">{nr.error}</p>
                  ) : null}
                  {/* Step input + output from persistence */}
                  <RunStepIoPanel result={nr} compact />
                </div>
              </details>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
