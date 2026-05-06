"use client"

import * as React from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  Inbox,
  Loader2,
  RefreshCw,
  SearchIcon,
  Workflow,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/page-header"
import { WorkflowApprovalDialog } from "@/components/workflow/workflow-approval-dialog"
import { cn } from "@/lib/utils"
import { shortRunIdForDisplay } from "@/lib/workflows/engine/run-timeline"
import type { WorkflowApprovalListRow } from "@/lib/workflows/queries/approval-queries"

/** API list row shape mirrors Supabase nested `workflows` join */
type InboxApprovalRow = WorkflowApprovalListRow

export interface InboxClientProps {
  /** Server-rendered first paint */
  initialApprovals: InboxApprovalRow[]
  className?: string
}

/** Compact filter trigger — matches Workflows / Runs toolbar pills. */
const FILTER_TRIGGER_CLASS =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

/**
 * Pending human approvals: Workflows-aligned layout (toolbar, overview tiles, bordered table)
 * plus a centred review dialog for approving or declining.
 */
export function InboxClient({ initialApprovals, className }: InboxClientProps) {
  const [approvals, setApprovals] = React.useState<InboxApprovalRow[]>(initialApprovals)
  const [busyRow, setBusyRow] = React.useState<{ id: string; action: "approved" | "declined" } | null>(
    null,
  )
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [detail, setDetail] = React.useState<InboxApprovalRow | null>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return approvals
    return approvals.filter((row) => {
      const wf =
        typeof row.workflows?.name === "string" ? row.workflows.name.toLowerCase() : ""
      const title = (row.title ?? "").toLowerCase()
      const desc = (row.description ?? "").toLowerCase()
      const instr = (row.reviewer_instructions ?? "").toLowerCase()
      const nid = row.node_id.toLowerCase()
      return (
        wf.includes(q) ||
        title.includes(q) ||
        desc.includes(q) ||
        instr.includes(q) ||
        nid.includes(q)
      )
    })
  }, [approvals, query])

  async function refreshFromApi() {
    setError(null)
    const res = await fetch("/api/approvals")
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null
      setError(typeof j?.error === "string" ? j.error : "Could not load inbox.")
      return
    }
    const body = (await res.json()) as { approvals?: InboxApprovalRow[] }
    const next = Array.isArray(body.approvals) ? body.approvals : []
    setApprovals(next)
    setDetail((row) => {
      if (!row) return null
      return next.find((r) => r.id === row.id) ?? null
    })
  }

  async function respond(params: {
    approvalId: string
    decision: "approved" | "declined"
  }) {
    const { approvalId, decision } = params
    setBusyRow({ id: approvalId, action: decision })
    setError(null)
    try {
      const res = await fetch(`/api/approvals/${approvalId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg =
          typeof (body as { error?: unknown }).error === "string"
            ? (body as { error: string }).error
            : "Request failed"
        setError(msg)
        return
      }

      const runId =
        typeof (body as { runId?: unknown }).runId === "string" ? (body as { runId: string }).runId : null

      setDetail(null)
      await refreshFromApi()

      if (decision === "approved" && runId) {
        window.location.href = `/app/run/${runId}`
      }
    } finally {
      setBusyRow(null)
    }
  }

  function workflowNameOf(row: InboxApprovalRow) {
    const n = row.workflows?.name
    if (typeof n === "string" && n.trim() !== "") return n.trim()
    return "Untitled workflow"
  }

  return (
    <div className={cn("flex min-h-0 flex-col bg-background", className)}>
      {/* ── Header (matches Workflows: title + toolbar action slot) ── */}
      <PageHeader
        title="Inbox"
        description="Review paused workflow runs and approve or decline to continue execution."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          aria-label="Refresh inbox"
          onClick={() => void refreshFromApi()}
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </PageHeader>

      {/* ── Body: Workflows-aligned padding and vertical rhythm ── */}
      <div className="flex flex-col gap-6 p-6">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-red-900/55 dark:bg-red-950/40 dark:text-red-50">
            {error}
          </div>
        ) : null}

        {/* ── Search (same affordance as Workflows index) ── */}
        <div className="flex min-w-0 flex-col gap-2 pb-0.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          <div
            className={cn(
              FILTER_TRIGGER_CLASS,
              "min-h-9 w-full min-w-0 max-w-md flex-1 justify-start gap-2 py-0 pl-2 pr-2 lg:max-w-md",
            )}
          >
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by workflow, step title, or approval message…"
              className="h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Search approvals"
            />
          </div>
        </div>

        {/* ── Overview tiles (filtered count) ── */}
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-foreground">Overview</p>
          <p className="text-xs text-muted-foreground">
            Items below match your search. Each row needs a decision before the workflow can continue past the
            approval step.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">In queue</p>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
                {filtered.length}
              </p>
              {query.trim().length > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{approvals.length}</span> total · filtered
                </p>
              ) : null}
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">How reviewing works</p>
              <p className="mt-1 text-sm text-muted-foreground leading-snug">
                Open an item for full context — resolved approval message (when the builder adds one with tags), the
                step summary, then expandable run context.
              </p>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Step</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Waiting</th>
                <th className="px-4 py-3">Run</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                        <Inbox className="size-6 text-muted-foreground/50" aria-hidden />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Nothing in your inbox</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          When a workflow hits an Approval step you own, it will appear here for review.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <p className="font-medium text-foreground">No approvals match your search</p>
                    <p className="mt-1 text-sm">
                      Try a shorter term or clear search to show all queued items ({approvals.length} total).
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const wf = workflowNameOf(row)
                  const isRowBusy = busyRow?.id === row.id

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/80 transition-colors hover:bg-muted/30 last:border-0 cursor-pointer"
                      onClick={() => setDetail(row)}
                    >
                      {/* Step */}
                      <td className="max-w-[16rem] px-4 py-3 align-top">
                        <p className="truncate font-medium text-foreground">
                          {(row.title ?? "").trim() || "Approval required"}
                        </p>
                        {row.reviewer_instructions && row.reviewer_instructions.trim() !== "" ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.reviewer_instructions}</p>
                        ) : row.description && row.description.trim() !== "" ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.description}</p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground/90">No approval message configured</p>
                        )}
                      </td>
                      {/* Workflow */}
                      <td className="max-w-[14rem] px-4 py-3 align-top">
                        <Link
                          href={`/app/workflows/${row.workflow_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="truncate font-medium text-primary underline-offset-4 hover:underline inline-flex items-center gap-1.5"
                        >
                          <Workflow className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate">{wf}</span>
                        </Link>
                      </td>
                      {/* Waiting */}
                      <td className="whitespace-nowrap px-4 py-3 align-top tabular-nums text-muted-foreground">
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      </td>
                      {/* Run id */}
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/app/run/${row.workflow_run_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                        >
                          {shortRunIdForDisplay(row.workflow_run_id)}
                        </Link>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 text-right align-top">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isRowBusy}
                            onClick={(e) => {
                              e.stopPropagation()
                              void respond({ approvalId: row.id, decision: "declined" })
                            }}
                          >
                            {isRowBusy && busyRow?.action === "declined" ? (
                              <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                            ) : null}
                            Reject
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="border-emerald-700/20 bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                            disabled={isRowBusy}
                            onClick={(e) => {
                              e.stopPropagation()
                              void respond({ approvalId: row.id, decision: "approved" })
                            }}
                          >
                            {isRowBusy && busyRow?.action === "approved" ? (
                              <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                            ) : null}
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isRowBusy}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDetail(row)
                            }}
                          >
                            Review
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Hint under table */}
        {filtered.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Use row actions for quick approve/reject, or open{" "}
            <span className="font-medium text-foreground">Review</span> when you need the full briefing.
          </p>
        ) : null}
      </div>

      <WorkflowApprovalDialog
        open={detail !== null}
        onOpenChange={({ open }) => {
          if (!open) setDetail(null)
        }}
        approval={detail}
        busyRow={busyRow}
        onRespond={(p) => void respond(p)}
      />
    </div>
  )
}
