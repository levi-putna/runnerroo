"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { ChevronRight, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WorkflowRunListItem } from "@/lib/workflows/run-queries"
import { RunStatusGlyph } from "@/components/workflow/run-status-glyph"
import {
  displayRunDuration,
  formatRunLocalDate,
  runPersistedLifecycleLabel,
} from "@/lib/workflow/run-formatting"
import { shortRunIdForDisplay } from "@/lib/workflow/run-timeline"

export interface WorkflowRunHubClientProps {
  runs: WorkflowRunListItem[]
}

/**
 * Dashboard-style hub: breadcrumbs, dense bordered table with row navigation into run detail.
 */
export function WorkflowRunHubClient({ runs }: WorkflowRunHubClientProps) {
  const router = useRouter()

  return (
    <div className="flex min-h-[calc(100vh-112px)] flex-col bg-background">
      {/* Top chrome — breadcrumbs + title */}
      <div className="shrink-0 border-b border-border/80 bg-muted/15 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground"
          >
            <Link
              href="/workflows"
              className="font-medium underline-offset-4 hover:text-foreground hover:underline"
            >
              Workflows
            </Link>
            {/* Trail */}
            <ChevronRight aria-hidden className="size-3 shrink-0 opacity-50" />
            <span className="font-medium text-foreground">Runs</span>
          </nav>

          <div className="mt-5 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Runs</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Recent executions stored for your workflows. Choose a row to open the waterfall, trigger
              payload, and per-step payloads.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {/* Section label */}
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent activity
          </p>

          {runs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No saved runs yet. Execute a workflow from the editor to populate this list.
              </p>
              <Link
                href="/workflows"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-4 inline-flex"
                )}
              >
                Go to workflows
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card">
              <Table className="min-w-[640px]">
                <TableHeader className="border-b border-border/70 bg-muted/40 dark:bg-muted/25">
                  <TableRow className="border-0 hover:bg-transparent [&:hover]:bg-transparent">
                    <TableHead className="w-[140px] pl-4">Status</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead className="hidden w-[120px] sm:table-cell">Trigger</TableHead>
                    <TableHead className="hidden w-[180px] md:table-cell">Started</TableHead>
                    <TableHead className="hidden w-[100px] text-right lg:table-cell">Duration</TableHead>
                    <TableHead className="w-10 pr-4 text-right" aria-hidden>
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const runIdLine =
                      run.wdk_run_id?.trim() || shortRunIdForDisplay(run.id)
                    const wfName = run.workflows?.name?.trim() || "Untitled workflow"
                    const openRun = () => router.push(`/run/${run.id}`)

                    return (
                      <TableRow
                        key={run.id}
                        tabIndex={0}
                        role="link"
                        className={cn(
                          "cursor-pointer border-border/35 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        )}
                        aria-label={`Open run ${runIdLine} for ${wfName}`}
                        onClick={openRun}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            openRun()
                          }
                        }}
                      >
                        {/* Status */}
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-2">
                            <RunStatusGlyph status={run.status} className="size-4 shrink-0" />
                            <span className="text-[13px] font-medium wrap-break-word">
                              {runPersistedLifecycleLabel(run.status)}
                            </span>
                          </div>
                        </TableCell>

                        {/* Workflow + run id */}
                        <TableCell>
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-[13px] font-semibold leading-tight">{wfName}</p>
                            <code className="block truncate font-mono text-[11px] text-muted-foreground">
                              {runIdLine}
                            </code>
                            {/* Narrow columns: repeat key metadata */}
                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground md:hidden tabular-nums">
                              <Badge variant="outline" className="h-6 px-1.5 py-0 text-[10px] font-normal uppercase">
                                {run.trigger_type}
                              </Badge>
                              <span className="inline-flex items-center gap-1">
                                <Clock aria-hidden className="size-3 shrink-0" />
                                {displayRunDuration(run.duration_ms)}
                              </span>
                              <span className="tabular-nums">{formatRunLocalDate(run.started_at)}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Trigger */}
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="font-normal uppercase">
                            {run.trigger_type}
                          </Badge>
                        </TableCell>

                        {/* Started */}
                        <TableCell className="hidden text-[13px] tabular-nums text-muted-foreground md:table-cell">
                          {formatRunLocalDate(run.started_at)}
                        </TableCell>

                        {/* Duration */}
                        <TableCell className="hidden text-right text-[13px] font-medium whitespace-nowrap tabular-nums lg:table-cell">
                          {displayRunDuration(run.duration_ms)}
                        </TableCell>

                        {/* Affordance */}
                        <TableCell className="pr-4 text-right text-muted-foreground">
                          <ChevronRight aria-hidden className="ml-auto size-4" />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
