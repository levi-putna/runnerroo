import type { NodeResult } from "@/lib/workflows/engine/types"
import type { Json } from "@/types/database"

/**
 * Parses persisted `workflow_runs.node_results` JSON into a typed {@link NodeResult} list.
 */
export function normaliseWorkflowRunNodeResults({ value }: { value: Json }): NodeResult[] {
  if (!Array.isArray(value)) return []
  const out: NodeResult[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const node_id = typeof o.node_id === "string" ? o.node_id : null
    const status =
      o.status === "pending" ||
      o.status === "running" ||
      o.status === "success" ||
      o.status === "failed" ||
      o.status === "skipped"
        ? o.status
        : null
    if (!node_id || !status) continue
    out.push({
      node_id,
      status,
      started_at: typeof o.started_at === "string" ? o.started_at : undefined,
      completed_at: typeof o.completed_at === "string" ? o.completed_at : undefined,
      input: "input" in o ? (o.input as unknown) : undefined,
      output: "output" in o ? (o.output as unknown) : undefined,
      error: typeof o.error === "string" ? o.error : undefined,
    })
  }
  return out
}

/**
 * Pretty-prints serialised run payloads for read-only UI.
 */
export function stringifyRunJsonPayload(payload: unknown) {
  try {
    return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}
