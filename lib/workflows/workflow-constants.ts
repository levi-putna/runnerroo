import type { Json } from "@/types/database"

/**
 * Normalises arbitrary JSON (typically from `workflows.workflow_constants`) into a flat string map.
 * Non-string primitives are coerced with `String()`; nested objects are skipped.
 */
export function normaliseWorkflowConstantsJson(value: unknown): Record<string, string> {
  if (value == null) return {}
  if (typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [rawKey, rawVal] of Object.entries(value as Record<string, unknown>)) {
    const key = rawKey.trim()
    if (!key) continue
    if (typeof rawVal === "string") {
      out[key] = rawVal
      continue
    }
    if (rawVal == null) continue
    if (typeof rawVal === "number" || typeof rawVal === "boolean") {
      out[key] = String(rawVal)
    }
  }
  return out
}

export interface WorkflowConstantsRowsFromRecordParams {
  record: Record<string, string>
}

/**
 * Stable row list for editors — sorted by key so tables render predictably.
 */
export function workflowConstantsRowsFromRecord({
  record,
}: WorkflowConstantsRowsFromRecordParams): { id: string; key: string; value: string }[] {
  return Object.entries(record)
    .map(([key, value]) => ({ id: key, key, value }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

export interface WorkflowConstantsRecordFromRowsParams {
  rows: { key: string; value: string }[]
}

/**
 * Last row wins when duplicate keys appear after trim.
 */
export function workflowConstantsRecordFromRows({
  rows,
}: WorkflowConstantsRecordFromRowsParams): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) continue
    out[key] = row.value
  }
  return out
}

/**
 * Serialises a constants map for Supabase `jsonb` columns.
 */
export function workflowConstantsToJson({ record }: { record: Record<string, string> }): Json {
  return record as unknown as Json
}
