"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Workflow } from "lucide-react";
import {
  getToolOrDynamicToolName,
  type DynamicToolUIPart,
  type ChatAddToolApproveResponseFunction,
  type ChatAddToolOutputFunction,
  type UIMessage,
} from "ai";

import { AssistantToolCard } from "@/components/tool/assistant-tool-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isWorkflowAssistantToolName,
  WORKFLOW_ASSISTANT_TOOL_OUTPUT_NAME_KEY,
} from "@/lib/workflows/assistant-workflow-invoke-support";

type Props = {
  part: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  addToolOutput?: ChatAddToolOutputFunction<UIMessage>;
};

function safeStringify({ value }: { value: unknown }): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function readWorkflowInvokeDisplayName({ value }: { value: unknown }): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>)[WORKFLOW_ASSISTANT_TOOL_OUTPUT_NAME_KEY];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

/**
 * Removes tooling-only keys from a copy of the payload before rendering End-style field rows.
 */
function stripWorkflowInvokeToolingKeys({ value }: { value: Record<string, unknown> }): Record<string, unknown> {
  const next = { ...value };
  delete next[WORKFLOW_ASSISTANT_TOOL_OUTPUT_NAME_KEY];
  return next;
}

function sortedEntriesFromRecord({ record }: { record: Record<string, unknown> }): Array<[string, unknown]> {
  return Object.keys(record)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => [k, record[k]]);
}

function isWorkflowInvokeFailureEnvelope(value: unknown): value is { success: false; error: string } {
  const record = value as Record<string, unknown> | null;
  return (
    typeof value === "object" &&
    value !== null &&
    record?.success === false &&
    record?.awaiting_approval !== true &&
    typeof record?.error === "string"
  );
}

interface DisplayValueProps {
  value: unknown;
  depth: number;
}

const MAX_DEPTH = 4;

/**
 * Renders a tool value as readable text or nested name/value blocks (falls back to JSON at depth limit).
 */
function DisplayValue({ value, depth }: DisplayValueProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (typeof value === "boolean") {
    return <span>{value ? "Yes" : "No"}</span>;
  }

  if (typeof value === "number") {
    return <span className="tabular-nums">{String(value)}</span>;
  }

  if (typeof value === "string") {
    return <span className="whitespace-pre-wrap break-words">{value}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">Empty list</span>;
    }
    if (depth >= MAX_DEPTH) {
      return (
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-muted-foreground">
          {safeStringify({ value })}
        </pre>
      );
    }
    return (
      <ol className="list-none space-y-2 pl-0">
        {value.map((item, i) => (
          <li key={i} className="flex gap-2 text-left">
            <span className="w-6 shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <DisplayValue value={item} depth={depth + 1} />
            </div>
          </li>
        ))}
      </ol>
    );
  }

  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) {
      return (
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-muted-foreground">
          {safeStringify({ value })}
        </pre>
      );
    }
    const entries = sortedEntriesFromRecord({ record: value as Record<string, unknown> });
    if (entries.length === 0) {
      return <span className="text-muted-foreground">Empty</span>;
    }
    return (
      <div className="rounded-md border border-border/70 bg-muted/15 px-2 py-2">
        <KeyValueTable entries={entries} depth={depth + 1} />
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

interface KeyValueTableProps {
  entries: Array<[string, unknown]>;
  depth: number;
}

/**
 * Presents parameters or results as labelled rows instead of a raw JSON blob.
 */
function KeyValueTable({ entries, depth }: KeyValueTableProps) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No fields</p>;
  }

  return (
    <dl className="grid gap-0">
      {entries.map(([key, val]) => (
        <div
          key={key}
          className="grid grid-cols-1 gap-1 border-b border-border/50 py-2 last:border-b-0 sm:grid-cols-[minmax(0,38%)_minmax(0,62%)] sm:gap-3"
        >
          <dt className="text-[11px] font-semibold leading-snug text-muted-foreground break-words">{key}</dt>
          <dd className="min-w-0 text-xs leading-snug text-foreground">
            <DisplayValue value={val} depth={depth} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface ResultBodyProps {
  output: Record<string, unknown>;
}

type PendingApprovalRow = {
  id: string;
  node_id: string;
  title: string | null;
  workflow_run_id: string;
};

type WorkflowInvokeApprovalEnvelope = {
  success: false;
  awaiting_approval: true;
  run_id: string;
  approval_id?: string | null;
  approval_node_id?: string | null;
  approval_title?: string | null;
  approval_description?: string | null;
  approval_reviewer_instructions?: string | null;
  error?: string;
};

function readAwaitingApprovalEnvelope({
  value,
}: {
  value: Record<string, unknown>;
}): WorkflowInvokeApprovalEnvelope | null {
  if (value.awaiting_approval !== true) return null;
  const runId = typeof value.run_id === "string" && value.run_id.trim() !== "" ? value.run_id : null;
  if (!runId) return null;
  return {
    success: false,
    awaiting_approval: true,
    run_id: runId,
    approval_id: typeof value.approval_id === "string" ? value.approval_id : null,
    approval_node_id: typeof value.approval_node_id === "string" ? value.approval_node_id : null,
    approval_title: typeof value.approval_title === "string" ? value.approval_title : null,
    approval_description: typeof value.approval_description === "string" ? value.approval_description : null,
    approval_reviewer_instructions:
      typeof value.approval_reviewer_instructions === "string"
        ? value.approval_reviewer_instructions
        : null,
    ...(typeof value.error === "string" ? { error: value.error } : {}),
  };
}

function normalisePendingApprovalRow({
  value,
}: {
  value: unknown;
}): PendingApprovalRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : null;
  const nodeId = typeof row.node_id === "string" ? row.node_id : null;
  const runId = typeof row.workflow_run_id === "string" ? row.workflow_run_id : null;
  if (!id || !nodeId || !runId) return null;
  return {
    id,
    node_id: nodeId,
    workflow_run_id: runId,
    title: typeof row.title === "string" ? row.title : null,
  };
}

function readRunStatusFromUnknown({
  value,
}: {
  value: unknown;
}): string | null {
  if (!value || typeof value !== "object") return null;
  const status = (value as Record<string, unknown>).status;
  return typeof status === "string" ? status : null;
}

/**
 * Strips tooling keys; shows multi-end `outputs` distinctly when present; otherwise a flat table.
 */
function WorkflowInvokeResultBody({ output }: ResultBodyProps) {
  const stripped = stripWorkflowInvokeToolingKeys({ value: output });
  const outputsRaw = stripped.outputs;

  if (Array.isArray(outputsRaw) && outputsRaw.length > 0) {
    const rest = { ...stripped };
    delete rest.outputs;
    const restEntries = sortedEntriesFromRecord({ record: rest });

    return (
      <div className="space-y-4">
        {/* Single-table remainder when other keys sit beside `outputs` */}
        {restEntries.length > 0 ? (
          <div className="rounded-md border border-border/80 bg-background px-3 py-1">
            <KeyValueTable entries={restEntries} depth={0} />
          </div>
        ) : null}

        {/* One subsection per End branch */}
        <div className="space-y-3">
          {outputsRaw.map((item, i) => (
            <div key={i} className="rounded-md border border-border/80 bg-background px-3 py-1">
              <div className="py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                End output {i + 1}
              </div>
              {item !== null && typeof item === "object" && !Array.isArray(item) ? (
                <KeyValueTable
                  entries={sortedEntriesFromRecord({ record: item as Record<string, unknown> })}
                  depth={0}
                />
              ) : (
                <div className="pb-2">
                  <DisplayValue value={item} depth={0} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/80 bg-background px-3 py-1">
      <KeyValueTable entries={sortedEntriesFromRecord({ record: stripped })} depth={0} />
    </div>
  );
}

/**
 * Chat UI for invoke-workflow assistant tools (`wf` + UUID hex).
 */
export function WorkflowInvokeToolUI({
  part,
  addToolApprovalResponse: _addToolApprovalResponse,
  addToolOutput: _addToolOutput,
}: Props) {
  const toolName = getToolOrDynamicToolName(part);
  const isWorkflowTool = isWorkflowAssistantToolName({ toolName });

  void _addToolApprovalResponse;
  void _addToolOutput;

  const defaultTitle = "Workflow";
  const [pendingApproval, setPendingApproval] = useState<PendingApprovalRow | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineBusy, setInlineBusy] = useState<"approved" | "declined" | null>(null);

  const inputPayload = (part.input ?? {}) as Record<string, unknown>;
  const parameterEntries = sortedEntriesFromRecord({ record: inputPayload });
  const outputPayload =
    part.state === "output-available" && part.output && typeof part.output === "object"
      ? (part.output as Record<string, unknown>)
      : null;
  const awaitingApprovalEnvelope = outputPayload
    ? readAwaitingApprovalEnvelope({ value: outputPayload })
    : null;
  const awaitingApprovalRunId = awaitingApprovalEnvelope?.run_id ?? null;
  const awaitingApprovalHintId = awaitingApprovalEnvelope?.approval_id ?? null;

  useEffect(() => {
    if (!isWorkflowTool || !awaitingApprovalRunId) {
      return;
    }
    let cancelled = false;

    const loadPending = async () => {
      try {
        const response = await fetch(
          `/api/approvals?workflow_run_id=${encodeURIComponent(awaitingApprovalRunId)}`,
          { cache: "no-store" },
        );
        const body = (await response.json().catch(() => ({}))) as {
          approvals?: unknown[];
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setInlineError(typeof body.error === "string" ? body.error : "Could not load pending approval.");
          setPendingApproval(null);
          return;
        }
        const rows = Array.isArray(body.approvals) ? body.approvals : [];
        const normalised = rows.map((row) => normalisePendingApprovalRow({ value: row })).filter(Boolean) as PendingApprovalRow[];
        const preferred =
          awaitingApprovalHintId != null
            ? normalised.find((row) => row.id === awaitingApprovalHintId) ?? null
            : null;
        setPendingApproval(preferred ?? normalised[0] ?? null);
      } catch {
        if (!cancelled) {
          setInlineError("Could not load pending approval.");
        }
      }
    };

    void loadPending();
    const intervalId = window.setInterval(() => {
      void loadPending();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [awaitingApprovalHintId, awaitingApprovalRunId, isWorkflowTool]);

  const respondInline = async ({ decision }: { decision: "approved" | "declined" }) => {
    if (!pendingApproval || !awaitingApprovalRunId) return;
    setInlineBusy(decision);
    setInlineError(null);
    try {
      const response = await fetch(`/api/approvals/${pendingApproval.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setInlineError(typeof body.error === "string" ? body.error : "Could not apply decision.");
        return;
      }
      setPendingApproval(null);

      let settled = false;
      for (let i = 0; i < 30; i += 1) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 1000);
        });
        const runRes = await fetch(`/api/run/${awaitingApprovalRunId}`, { cache: "no-store" });
        if (!runRes.ok) continue;
        const runBody = (await runRes.json().catch(() => ({}))) as { run?: unknown };
        const status = readRunStatusFromUnknown({ value: runBody.run });
        if (status === "waiting_approval" || status === "success" || status === "failed") {
          settled = true;
          break;
        }
      }
      if (!settled && decision === "approved") {
        setInlineError("Approval recorded. Workflow is still resuming; check run details shortly.");
      }
    } catch {
      setInlineError("Could not apply decision.");
    } finally {
      setInlineBusy(null);
    }
  };

  if (!isWorkflowTool) {
    return null;
  }

  // ─── input-streaming / input-available ─────────────────────────────────────
  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <AssistantToolCard title={defaultTitle} icon={Workflow} variant="loading">
        {/* Streaming parameters */}
        <div className="space-y-2 text-xs">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </AssistantToolCard>
    );
  }

  // ─── approval-requested / approval-responded / output-denied (unused today) ─
  if (
    part.state === "approval-requested" ||
    part.state === "approval-responded" ||
    part.state === "output-denied"
  ) {
    return (
      <AssistantToolCard title={defaultTitle} icon={Workflow}>
        {/* Approval placeholder — invoke tools do not use needsApproval */}
        <p className="text-xs text-muted-foreground">
          This workflow tool does not require interactive approval.
        </p>
      </AssistantToolCard>
    );
  }

  // ─── output-available ──────────────────────────────────────────────────────
  if (part.state === "output-available") {
    const out = outputPayload as Record<string, unknown>;
    const failed = isWorkflowInvokeFailureEnvelope(out);
    const heading = readWorkflowInvokeDisplayName({ value: out }) ?? defaultTitle;
    const awaitingApproval = readAwaitingApprovalEnvelope({ value: out }) !== null;
    const showPendingApprovalUi = awaitingApproval && pendingApproval !== null;

    return (
      <AssistantToolCard
        title={heading}
        icon={Workflow}
        variant={failed ? "error" : showPendingApprovalUi ? "loading" : "success"}
        forceExpanded={showPendingApprovalUi}
        headerActions={
          showPendingApprovalUi ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={inlineBusy !== null}
                onClick={() => {
                  void respondInline({ decision: "declined" });
                }}
              >
                {inlineBusy === "declined" ? "Rejecting…" : "Reject"}
              </Button>
              <Button
                type="button"
                size="xs"
                disabled={inlineBusy !== null}
                onClick={() => {
                  void respondInline({ decision: "approved" });
                }}
              >
                {inlineBusy === "approved" ? "Approving…" : "Approve"}
              </Button>
            </>
          ) : null
        }
      >
        {showPendingApprovalUi ? (
          <div className="space-y-2 rounded-md border border-violet-400/35 bg-violet-500/10 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-violet-900 dark:text-violet-100">
              Approval required
            </div>
            <p className="text-xs text-violet-900/90 dark:text-violet-100/90">
              {pendingApproval.title?.trim() ||
                awaitingApprovalEnvelope?.approval_title?.trim() ||
                "This workflow run is paused for approval."}
            </p>
            {awaitingApprovalEnvelope?.approval_reviewer_instructions ? (
              <p className="whitespace-pre-wrap text-xs text-violet-900/90 dark:text-violet-100/90">
                {awaitingApprovalEnvelope.approval_reviewer_instructions}
              </p>
            ) : awaitingApprovalEnvelope?.approval_description ? (
              <p className="whitespace-pre-wrap text-xs text-violet-900/90 dark:text-violet-100/90">
                {awaitingApprovalEnvelope.approval_description}
              </p>
            ) : null}
            {inlineError ? <p className="text-xs text-destructive">{inlineError}</p> : null}
          </div>
        ) : null}

        {/* Invoke parameters supplied by the model */}
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Parameters</div>
          <div className="max-h-48 overflow-auto rounded-md border border-border/80 bg-muted/20 px-3 py-1">
            <KeyValueTable entries={parameterEntries} depth={0} />
          </div>
        </div>

        {/* Published End payload(s), or structured failure rows; tooling display name omitted */}
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Result</div>
          <div className="max-h-72 overflow-auto">
            <WorkflowInvokeResultBody output={out} />
          </div>
        </div>
      </AssistantToolCard>
    );
  }

  // ─── output-error ───────────────────────────────────────────────────────────
  if (part.state === "output-error") {
    return (
      <AssistantToolCard title={defaultTitle} icon={Workflow} variant="error">
        {/* Failure details */}
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{part.errorText ?? "Workflow tool failed."}</span>
        </div>
        <div className="max-h-40 overflow-auto rounded-md border border-border/60 bg-muted/20 px-3 py-1">
          <KeyValueTable entries={parameterEntries} depth={0} />
        </div>
      </AssistantToolCard>
    );
  }

  return null;
}
