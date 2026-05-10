import type { ProviderOptions } from "@ai-sdk/provider-utils";

/** Spend-report tag prefix for assistant conversations (`conversation:<id>`). */
export const GATEWAY_USAGE_TAG_PREFIX_CONVERSATION = "conversation:" as const;

/** Spend-report tag prefix for workflow runs (`workflow_run:<run id>`). */
export const GATEWAY_USAGE_TAG_PREFIX_WORKFLOW_RUN = "workflow_run:" as const;

/** Embedding calls issued while persisting or updating a memory. */
export const GATEWAY_USAGE_TAG_MEMORY_WRITE = "memory:write" as const;

/** Embedding calls issued while hybrid memory search runs. */
export const GATEWAY_USAGE_TAG_MEMORY_QUERY = "memory:query" as const;

/** Spend-report tag for structured memory review LLM calls after a turn. */
export const GATEWAY_USAGE_TAG_MEMORY_REVIEW = "memory:review" as const;

/** Envelope key on each workflow `stepInput` carrying {@link RunnerGatewayExecutionContext}. */
export const RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY = "__dailify_gateway_context" as const;

/** Legacy key from before the Dailify rebrand — still accepted when reading persisted envelopes. */
export const LEGACY_RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY = "__runnerroo_gateway_context" as const;

export type RunnerGatewayExecutionContext = {
  supabaseUserId: string;
  workflowId: string;
  workflowRunId: string;
  /** Persisted workflow title for `{{workflow.name}}`; optional when callers omit it. */
  workflowName?: string;
  /** Resolved display name for `{{user.name}}`; optional when callers omit identity. */
  userDisplayName?: string;
  /** Account email for `{{user.email}}`; optional when callers omit identity. */
  userEmail?: string | null;
};

/**
 * Reads workflow-run attribution injected by {@link traverseWorkflowGraph} into each step envelope.
 */
export function readRunnerGatewayExecutionContextFromStepInput({
  stepInput,
}: {
  stepInput: unknown;
}): RunnerGatewayExecutionContext | null {
  if (typeof stepInput !== "object" || stepInput === null) {
    return null;
  }
  const raw =
    (stepInput as Record<string, unknown>)[RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY] ??
    (stepInput as Record<string, unknown>)[LEGACY_RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY];
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const supabaseUserId = typeof o.supabaseUserId === "string" ? o.supabaseUserId.trim() : "";
  const workflowId = typeof o.workflowId === "string" ? o.workflowId.trim() : "";
  const workflowRunId = typeof o.workflowRunId === "string" ? o.workflowRunId.trim() : "";
  if (!supabaseUserId || !workflowId || !workflowRunId) {
    return null;
  }
  const workflowName =
    typeof o.workflowName === "string" && o.workflowName.trim() !== ""
      ? o.workflowName.trim()
      : undefined;
  const userDisplayName =
    typeof o.userDisplayName === "string" ? o.userDisplayName.trim() : undefined;
  const rawEmail = o.userEmail;
  const out: RunnerGatewayExecutionContext = { supabaseUserId, workflowId, workflowRunId };
  if (workflowName) {
    out.workflowName = workflowName;
  }
  if (userDisplayName) {
    out.userDisplayName = userDisplayName;
  }
  if (typeof rawEmail === "string" && rawEmail.trim() !== "") {
    out.userEmail = rawEmail.trim();
  }
  return out;
}

/**
 * Builds AI SDK `providerOptions` so Vercel AI Gateway can attribute spend to a Supabase user and tags.
 */
export function buildRunnerGatewayProviderOptions({
  supabaseUserId,
  tags,
}: {
  supabaseUserId: string | null;
  tags: string[];
}): ProviderOptions {
  const gateway: { user?: string; tags: string[] } = { tags };
  if (supabaseUserId && supabaseUserId.length > 0) {
    gateway.user = supabaseUserId;
  }
  return { gateway };
}

/**
 * Gateway tags for assistant chat traffic (one stable conversation id per thread).
 */
export function gatewayUsageTagsForConversation({
  conversationId,
}: {
  conversationId: string | null;
}): string[] {
  const id = conversationId?.trim();
  return [
    id && id.length > 0
      ? `${GATEWAY_USAGE_TAG_PREFIX_CONVERSATION}${id}`
      : `${GATEWAY_USAGE_TAG_PREFIX_CONVERSATION}unknown`,
  ];
}

/**
 * Gateway tags for workflow AI nodes (group spend per persisted workflow run row).
 */
export function gatewayUsageTagsForWorkflowRun({
  workflowRunId,
}: {
  workflowRunId: string;
}): string[] {
  const id = workflowRunId.trim();
  return [`${GATEWAY_USAGE_TAG_PREFIX_WORKFLOW_RUN}${id}`];
}

/**
 * Gateway tags for memory embedding requests (write vs hybrid search), optionally
 * scoped to the assistant conversation for spend attribution.
 */
export function gatewayUsageTagsForMemoryEmbedding({
  purpose,
  conversationId,
}: {
  purpose: "memory_write" | "memory_query";
  /** When set, adds `conversation:<id>` alongside memory purpose tags. */
  conversationId?: string | null | undefined;
}): string[] {
  const purposeTag =
    purpose === "memory_query" ? GATEWAY_USAGE_TAG_MEMORY_QUERY : GATEWAY_USAGE_TAG_MEMORY_WRITE;
  return [...gatewayUsageTagsForConversation({ conversationId: conversationId ?? null }), purposeTag];
}
