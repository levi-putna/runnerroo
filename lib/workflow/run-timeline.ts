import type { NodeResult } from "@/lib/workflow/types"

export interface ParsedRunTimelineStep {
  id: string
  reactKey: string
  label: string
  status: NodeResult["status"]
  /** Milliseconds after `run.started_at` when the step began (for layout). */
  startMs: number
  /** Step wall time in ms; `0` when timestamps were not persisted. */
  durationMs: number
  result: NodeResult
  /** When false, only the step list / I/O panel should show this row (no Gantt bar). */
  hasTimelineBar: boolean
}

/** ISO string → unix ms */
function isoToMs(iso: string | undefined | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/**
 * Best-effort display name for timeline rows (friendly label from simulated JSON when possible).
 */
export function resolveRunStepTimelineLabel(nr: NodeResult): string {
  const out = nr.output
  if (out && typeof out === "object" && !Array.isArray(out)) {
    const o = out as Record<string, unknown>
    if (typeof o.label === "string" && o.label.trim()) {
      const kind = typeof o.kind === "string" ? o.kind.trim() : ""
      return kind ? `${kind} (${o.label.trim()})` : o.label.trim()
    }
  }
  const id = nr.node_id.trim() || "step"
  if (id.startsWith("__")) return id.replace(/^__|__$/g, "") || "workflow"
  return id
}

function shortRunIdForDisplay(runId: string) {
  const trimmed = runId.trim()
  if (trimmed.length <= 14) return trimmed
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`
}

export { shortRunIdForDisplay }

/**
 * Computes horizontal placement for a Vercel-style waterfall timeline using `started_at` / `completed_at` on each step.
 */
export function buildRunTimelineSteps(p: {
  runStartedAt: string
  runCompletedAt?: string | null
  runDurationMs?: number | null
  nodeResults: NodeResult[]
}): {
  timelineTotalMs: number
  runStartMs: number | null
  steps: ParsedRunTimelineStep[]
} {
  const runStartMs = isoToMs(p.runStartedAt)
  const runEndFromIso = isoToMs(p.runCompletedAt ?? null)
  const wallFromRow =
    runStartMs != null && p.runDurationMs != null && Number.isFinite(p.runDurationMs)
      ? p.runDurationMs
      : null
  const wallFromIso =
    runStartMs != null && runEndFromIso != null ? Math.max(0, runEndFromIso - runStartMs) : null

  const filtered = p.nodeResults.filter((r) => r.node_id?.trim() && r.node_id !== "__workflow__")

  const steps: ParsedRunTimelineStep[] = []

  for (const nr of filtered) {
    const label = resolveRunStepTimelineLabel(nr)
    const stepStart = isoToMs(nr.started_at)
    const stepEnd = isoToMs(nr.completed_at)

    const canPlace =
      runStartMs != null &&
      stepStart != null &&
      stepEnd != null &&
      stepEnd >= stepStart

    if (canPlace) {
      steps.push({
        id: nr.node_id,
        reactKey: `${nr.node_id}:${nr.started_at}`,
        label,
        status: nr.status,
        startMs: Math.max(0, stepStart - runStartMs),
        durationMs: stepEnd - stepStart,
        result: nr,
        hasTimelineBar: true,
      })
    } else {
      steps.push({
        id: nr.node_id,
        reactKey: `${nr.node_id}:${nr.started_at ?? "na"}`,
        label,
        status: nr.status,
        startMs: 0,
        durationMs: 0,
        result: nr,
        hasTimelineBar: false,
      })
    }
  }

  const lastStepEnd = steps.reduce((m, seg) => {
    if (!seg.hasTimelineBar) return m
    return Math.max(m, seg.startMs + seg.durationMs)
  }, 0)

  const wallMs = Math.max(
    wallFromRow ?? 0,
    wallFromIso ?? 0,
    lastStepEnd,
    1
  )

  return {
    timelineTotalMs: wallMs,
    runStartMs,
    steps,
  }
}
