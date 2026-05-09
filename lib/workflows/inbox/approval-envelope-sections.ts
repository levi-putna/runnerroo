import {
  LEGACY_RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY,
  RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY,
} from "@/lib/ai-gateway/runner-gateway-tracking"
import { stringify } from "@/lib/workflows/engine/template"

/** Marker on runner execution envelopes — must match `runner.ts`. */
const RUNNER_EXECUTION_MARKER = "__dailify_execution" as const

const LEGACY_RUNNER_EXECUTION_MARKER = "__runnerroo_execution" as const

/**
 * One titled block of labelled values for the inbox approval “technical details” panel.
 */
export type ApprovalEnvelopeSection = {
  /** Stable id for React keys */
  id: string
  /** Section heading */
  title: string
  /** Optional short explainer under the title */
  description?: string
  /** Label / value rows (values are pre-formatted for display) */
  rows: { label: string; value: string }[]
}

/**
 * Formats a single JSON-serialisable cell for human-readable tables (strings stay as-is;
 * nested values use compact JSON).
 */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value.trim() === "" ? "—" : value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  try {
    const s = JSON.stringify(value, null, typeof value === "object" ? 2 : undefined)
    return s ?? "—"
  } catch {
    return String(value)
  }
}

/**
 * Flattens a plain object into label/value rows sorted by key.
 */
function rowsFromRecord(record: Record<string, unknown>): { label: string; value: string }[] {
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b))
  return keys.map((key) => ({
    label: key,
    value: formatCell(record[key]),
  }))
}

/**
 * Turns the paused step’s execution envelope into approachable sections for reviewers.
 * Falls back to unstructured display when the payload is not a standard runner envelope.
 */
export function approvalEnvelopeSections({
  stepInput,
}: {
  stepInput: unknown
}): { sections: ApprovalEnvelopeSection[]; isStructuredEnvelope: boolean } {
  if (typeof stepInput !== "object" || stepInput === null) {
    return {
      sections: [],
      isStructuredEnvelope: false,
    }
  }

  const envelope = stepInput as Record<string, unknown>
  if (
    envelope[RUNNER_EXECUTION_MARKER] !== true &&
    envelope[LEGACY_RUNNER_EXECUTION_MARKER] !== true
  ) {
    return {
      sections: [],
      isStructuredEnvelope: false,
    }
  }

  const sections: ApprovalEnvelopeSection[] = []

  const gatewayRaw =
    envelope[RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY] ?? envelope[LEGACY_RUNNER_GATEWAY_EXECUTION_CONTEXT_KEY]
  if (gatewayRaw && typeof gatewayRaw === "object" && !Array.isArray(gatewayRaw)) {
    const g = gatewayRaw as Record<string, unknown>
    const gwRows: { label: string; value: string }[] = []
    if (typeof g.workflowName === "string" && g.workflowName.trim() !== "") {
      gwRows.push({ label: "Workflow", value: g.workflowName.trim() })
    }
    if (typeof g.workflowRunId === "string" && g.workflowRunId.trim() !== "") {
      gwRows.push({ label: "Run id", value: g.workflowRunId.trim() })
    }
    if (typeof g.userDisplayName === "string" && g.userDisplayName.trim() !== "") {
      gwRows.push({ label: "Started by", value: g.userDisplayName.trim() })
    }
    if (typeof g.userEmail === "string" && g.userEmail.trim() !== "") {
      gwRows.push({ label: "Email", value: g.userEmail.trim() })
    }
    if (gwRows.length > 0) {
      sections.push({
        id: "gateway",
        title: "Run context",
        description: "Who started this run and where it is executing.",
        rows: gwRows,
      })
    }
  }

  const trigger = envelope.trigger_inputs
  if (trigger && typeof trigger === "object" && !Array.isArray(trigger)) {
    const rows = rowsFromRecord(trigger as Record<string, unknown>)
    if (rows.length > 0) {
      sections.push({
        id: "trigger_inputs",
        title: "Workflow inputs",
        description: "Values supplied when this run was started (same as {{input.*}} in the editor).",
        rows,
      })
    }
  }

  const globals = envelope.globals
  if (globals && typeof globals === "object" && !Array.isArray(globals)) {
    const rows = rowsFromRecord(globals as Record<string, unknown>)
    if (rows.length > 0) {
      sections.push({
        id: "globals",
        title: "Workflow globals",
        description: "Merged global fields from earlier steps ({{global.*}}).",
        rows,
      })
    }
  }

  const pred = envelope.predecessor
  if (pred && typeof pred === "object" && !Array.isArray(pred)) {
    const p = pred as Record<string, unknown>
    const metaRows: { label: string; value: string }[] = []
    if (typeof p.node_id === "string") metaRows.push({ label: "Previous step id", value: p.node_id })
    if (typeof p.type === "string") metaRows.push({ label: "Previous step type", value: p.type })

    const emitted = p.step_output_emitted
    const outputRows =
      emitted && typeof emitted === "object" && !Array.isArray(emitted)
        ? rowsFromRecord(emitted as Record<string, unknown>).map((r) => ({
            label: `Output · ${r.label}`,
            value: r.value,
          }))
        : []

    if (metaRows.length > 0 || outputRows.length > 0) {
      sections.push({
        id: "predecessor_meta",
        title: "Previous step",
        description: "The step immediately before approval and what it produced ({{prev.*}}).",
        rows: [...metaRows, ...outputRows],
      })
    }
  }

  return { sections, isStructuredEnvelope: true }
}

/**
 * Stable string for collapsed “raw JSON” fallback chips.
 */
export function approvalEnvelopeRawJson({ stepInput }: { stepInput: unknown }): string {
  try {
    return typeof stepInput === "string" ? stepInput : JSON.stringify(stepInput, null, 2)
  } catch {
    return stringify(stepInput)
  }
}
