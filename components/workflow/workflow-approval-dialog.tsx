"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ChevronDown, ExternalLink, Loader2, Workflow } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  approvalEnvelopeRawJson,
  approvalEnvelopeSections,
} from "@/lib/workflows/inbox/approval-envelope-sections"
import type { WorkflowApprovalListRow } from "@/lib/workflows/queries/approval-queries"

export interface WorkflowApprovalDialogProps {
  open: boolean
  onOpenChange: (p: { open: boolean }) => void
  approval: WorkflowApprovalListRow | null
  isLoading?: boolean
  loadError?: string | null
  busyRow?: { id: string; action: "approved" | "declined" } | null
  onRespond: (p: { approvalId: string; decision: "approved" | "declined" }) => void | Promise<void>
}

/**
 * Centred modal for reviewing a pending workflow approval (approve / decline + briefing).
 * Reusable from Inbox, run detail, or anywhere else that has a {@link WorkflowApprovalListRow}.
 */
export function WorkflowApprovalDialog({
  open,
  onOpenChange,
  approval,
  isLoading = false,
  loadError = null,
  busyRow = null,
  onRespond,
}: WorkflowApprovalDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange({ open: next })
      }}
    >
      <DialogContent
        showCloseButton
        className="flex max-h-[min(90vh,720px)] w-full max-w-[min(520px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(520px,calc(100vw-2rem))]"
      >
        {loadError ? (
          <div className="border-b border-border/80 px-5 py-4">
            <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
          </div>
        ) : null}

        {isLoading && !approval ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Loading approval…</p>
          </div>
        ) : null}

        {!isLoading && !approval && !loadError ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No pending approval found for this context.
          </div>
        ) : null}

        {approval ? (
          <ApprovalDialogBody
            row={approval}
            busyRow={busyRow}
            workflowName={workflowNameOf({ row: approval })}
            onRespond={onRespond}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function workflowNameOf({ row }: { row: WorkflowApprovalListRow }) {
  const n = row.workflows?.name
  if (typeof n === "string" && n.trim() !== "") return n.trim()
  return "Untitled workflow"
}

/**
 * Header, scrollable briefing, and footer approve / decline actions (shared by {@link WorkflowApprovalDialog}).
 */
function ApprovalDialogBody({
  row,
  busyRow,
  workflowName,
  onRespond,
}: {
  row: WorkflowApprovalListRow
  busyRow: WorkflowApprovalDialogProps["busyRow"]
  workflowName: string
  onRespond: WorkflowApprovalDialogProps["onRespond"]
}) {
  const isRowBusy = busyRow?.id === row.id
  const isApproving = isRowBusy && busyRow?.action === "approved"
  const isDeclining = isRowBusy && busyRow?.action === "declined"
  const title = (row.title ?? "").trim() || "Approval required"
  const hasReviewer =
    typeof row.reviewer_instructions === "string" && row.reviewer_instructions.trim() !== ""

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 space-y-0 border-b border-border/80 px-5 py-5 text-left">
        {/* Title stack */}
        <div className="space-y-1 pr-8">
          <Badge variant="secondary" className="mb-2 w-fit border border-border/70 font-normal">
            Awaiting your decision
          </Badge>
          <DialogTitle className="text-left text-xl font-semibold leading-snug">{title}</DialogTitle>
          <DialogDescription className="text-left text-base text-muted-foreground">
            {workflowName}
          </DialogDescription>
          <p className="text-xs text-muted-foreground">
            Waiting {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} · step id{" "}
            <span className="font-mono text-[11px]">{row.node_id}</span>
          </p>
        </div>

        {/* Quick links */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild className="h-8">
            <Link href={`/app/workflows/${row.workflow_id}`}>
              <Workflow className="size-3.5" aria-hidden />
              Open workflow
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild className="h-8">
            <Link href={`/app/run/${row.workflow_run_id}`}>
              Open run
              <ExternalLink className="size-3.5 opacity-70" aria-hidden />
            </Link>
          </Button>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {/* Reviewer guidance */}
        <section aria-labelledby="reviewer-guidance-heading" className="space-y-2">
          <h3
            id="reviewer-guidance-heading"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            What to verify
          </h3>
          {hasReviewer ? (
            <div className="rounded-xl bg-muted/35 px-4 py-4 dark:bg-muted/30">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {row.reviewer_instructions}
              </p>
            </div>
          ) : (
            <div className="rounded-lg px-4 py-4 text-sm text-muted-foreground">
              <p>
                No approval message was configured for this step. Use the summary and context below if you need more
                detail before deciding.
              </p>
              <p className="mt-2 text-xs text-muted-foreground/90">
                Tip: Editors can set an <span className="font-medium">Approval message</span> on the Approval node (with
                tags such as {"{{prev.*}}"}) so reviewers see a clear checklist here.
              </p>
            </div>
          )}
        </section>

        {/* Summary */}
        {typeof row.description === "string" && row.description.trim() !== "" ? (
          <section aria-labelledby="summary-heading" className="space-y-2">
            <h3 id="summary-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Summary
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{row.description.trim()}</p>
          </section>
        ) : null}

        {/* Paused run context */}
        <section aria-labelledby="technical-heading" className="space-y-2">
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted/65"
            >
              <span
                id="technical-heading"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Context from the paused run
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ApprovalPausedRunContext stepInput={row.step_input} />
            </CollapsibleContent>
          </Collapsible>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Open when you need the exact payloads; approve or decline from the footer once you are satisfied.
          </p>
        </section>
      </div>

      <DialogFooter className="-mx-0 -mb-0 flex shrink-0 flex-col gap-3 rounded-none border-t border-border/80 bg-muted/50 px-5 py-4 sm:flex-row sm:justify-end">
        {/* Primary actions — footer for clear separation from scrollable briefing */}
        <Button
          type="button"
          variant="destructive"
          className="w-full sm:w-auto sm:min-w-[8rem]"
          disabled={isRowBusy}
          onClick={() => onRespond({ approvalId: row.id, decision: "declined" })}
        >
          {isDeclining ? <Loader2 className="mr-2 inline size-3.5 animate-spin" aria-hidden /> : null}
          Decline
        </Button>
        <Button
          type="button"
          className="w-full border-emerald-700/20 bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600 sm:w-auto sm:min-w-[8rem] dark:bg-emerald-600 dark:hover:bg-emerald-500"
          disabled={isRowBusy}
          onClick={() => onRespond({ approvalId: row.id, decision: "approved" })}
        >
          {isApproving ? <Loader2 className="mr-2 inline size-3.5 animate-spin" aria-hidden /> : null}
          Approve
        </Button>
      </DialogFooter>
    </div>
  )
}

/**
 * Presents the paused step envelope as labelled sections plus optional full JSON.
 */
function ApprovalPausedRunContext({ stepInput }: { stepInput: unknown }) {
  const { sections, isStructuredEnvelope } = approvalEnvelopeSections({ stepInput })
  const rawJson = approvalEnvelopeRawJson({ stepInput })

  return (
    <div className="mt-3 space-y-4">
      {sections.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isStructuredEnvelope
            ? "There is nothing extra to show beyond run metadata."
            : "This snapshot is not in the structured runner shape — use full JSON below if you need specifics."}
        </p>
      ) : (
        sections.map((section) => (
          <div key={section.id} className="rounded-lg border border-border/60 bg-card">
            <div className="border-b border-border/55 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">{section.title}</p>
              {section.description ? (
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{section.description}</p>
              ) : null}
            </div>
            <dl className="divide-y divide-border/50">
              {section.rows.map((r) => (
                <div
                  key={`${section.id}-${r.label}`}
                  className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,9rem)_1fr] sm:gap-4"
                >
                  <dt className="break-words text-[11px] font-medium text-muted-foreground">{r.label}</dt>
                  <dd className="min-w-0 text-xs leading-relaxed text-foreground">
                    <pre className="font-sans text-xs leading-relaxed break-words whitespace-pre-wrap">{r.value}</pre>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))
      )}

      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-border/80 bg-muted/25 px-3 py-2 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/45"
        >
          <span>Full JSON (advanced)</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 max-h-[min(280px,35vh)] overflow-auto rounded-md border border-border/50 bg-muted/20 p-3 font-mono text-[10px] leading-snug break-all whitespace-pre-wrap text-foreground/90">
            {rawJson}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
