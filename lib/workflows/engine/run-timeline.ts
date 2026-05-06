import type { NodeResult } from "@/lib/workflows/engine/types"

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

/** Steps longer than this (wall ms, exclusive) use a compressed middle when truncation is enabled. */
export const LONG_STEP_TIMELINE_COMPRESS_THRESHOLD_MS = 60_000

/** Wall-clock ms at true scale at each end of a long step before the cut. */
export const LONG_STEP_TIMELINE_COMPRESS_EDGE_MS = 20_000

/**
 * Virtual span on the *display* axis for each compressed interior,
 * analogous to omitted time in a broken-scale Gantt or editing timeline.
 */
export const LONG_STEP_TIMELINE_GAP_DISPLAY_MS = 12_000

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

type CompressInterior = { wallStart: number; wallEnd: number; gapDisplayMs: number }

/**
 * Wall intervals for long steps: first/last `LONG_STEP_TIMELINE_COMPRESS_EDGE_MS` stay true-to-scale;
 * the middle maps to `LONG_STEP_TIMELINE_GAP_DISPLAY_MS` on the display axis when `compressLongSteps` is true.
 */
function collectLongStepCompressInteriors(p: {
  timelineTotalMs: number
  steps: ParsedRunTimelineStep[]
  compressLongSteps: boolean
}): CompressInterior[] {
  if (!p.compressLongSteps) return []

  const interiors: CompressInterior[] = []
  const edge = LONG_STEP_TIMELINE_COMPRESS_EDGE_MS
  const threshold = LONG_STEP_TIMELINE_COMPRESS_THRESHOLD_MS

  for (const step of p.steps) {
    if (!step.hasTimelineBar) continue
    if (step.durationMs <= threshold) continue
    if (step.durationMs <= 2 * edge) continue

    const wallStart = step.startMs + edge
    const wallEnd = step.startMs + step.durationMs - edge
    if (wallEnd > wallStart) {
      interiors.push({
        wallStart,
        wallEnd,
        gapDisplayMs: LONG_STEP_TIMELINE_GAP_DISPLAY_MS,
      })
    }
  }

  return interiors
}

/**
 * Sorted wall-clock breakpoints so each interval is either fully inside or outside a compression interior.
 */
function buildWallBreakpoints(timelineTotalMs: number, interiors: CompressInterior[]): number[] {
  const pts = new Set<number>([0, timelineTotalMs])
  for (const i of interiors) {
    pts.add(i.wallStart)
    pts.add(i.wallEnd)
  }
  return [...pts].sort((a, b) => a - b)
}

/** Maps a wall-time sub-interval to display ms (1:1 outside interiors; scaled inside). */
function wallDeltaToDisplayDelta(
  w0: number,
  w1: number,
  interiors: CompressInterior[]
): number {
  const len = w1 - w0
  if (len <= 0) return 0

  for (const i of interiors) {
    if (w0 >= i.wallStart && w1 <= i.wallEnd) {
      const interiorWall = i.wallEnd - i.wallStart
      return interiorWall <= 0 ? 0 : (len / interiorWall) * i.gapDisplayMs
    }
  }

  return len
}

/**
 * Monotonic mapping from run-local wall ms to display coordinates when long steps are truncated (optional).
 */
export function computeTimelineDisplayAxis(p: {
  timelineTotalMs: number
  steps: ParsedRunTimelineStep[]
  compressLongSteps: boolean
}): {
  displayTotalMs: number
  wallToDisplay: (wallMs: number) => number
} {
  const timelineTotalMs = Math.max(0, p.timelineTotalMs)
  const interiors = collectLongStepCompressInteriors({
    timelineTotalMs,
    steps: p.steps,
    compressLongSteps: p.compressLongSteps,
  })
  const pts = buildWallBreakpoints(timelineTotalMs, interiors)

  function wallToDisplay(wallMs: number): number {
    const w = Math.max(0, Math.min(wallMs, timelineTotalMs))
    let d = 0
    for (let i = 0; i < pts.length - 1; i++) {
      const w0 = pts[i]!
      const w1 = pts[i + 1]!
      if (w >= w1) {
        d += wallDeltaToDisplayDelta(w0, w1, interiors)
      } else if (w > w0) {
        d += wallDeltaToDisplayDelta(w0, w, interiors)
        break
      } else {
        break
      }
    }
    return d
  }

  const displayTotalMs = wallToDisplay(timelineTotalMs)

  return { displayTotalMs, wallToDisplay }
}

export interface RunTimelineStepDisplayLayout {
  step: ParsedRunTimelineStep
  pctStart: number
  pctWidth: number
  compression: null | {
    leftFlex: number
    rightFlex: number
    /** Wall ms collapsed into the visual gap (still counted in labels and duration). */
    omittedWallMs: number
  }
}

/** Region on the 0–100% display axis matching a compressed time span (for the workflow summary bar). */
export type TimelineCompressRegionDisplay = {
  pctLeft: number
  pctWidth: number
  /** Wall ms represented by the compressed strip (for tooltips). */
  omittedWallMs: number
}

/**
 * Maps each step to percentage positions on the display axis; optional long-step truncation keeps other steps visible.
 */
export function buildRunTimelineDisplayLayout(p: {
  timelineTotalMs: number
  steps: ParsedRunTimelineStep[]
  compressLongSteps: boolean
}): {
  displayTotalMs: number
  rows: RunTimelineStepDisplayLayout[]
  compressRegionsDisplay: TimelineCompressRegionDisplay[]
} {
  const { displayTotalMs, wallToDisplay } = computeTimelineDisplayAxis(p)
  const timelineTotalMs = Math.max(0, p.timelineTotalMs)
  const interiors = collectLongStepCompressInteriors({
    timelineTotalMs,
    steps: p.steps,
    compressLongSteps: p.compressLongSteps,
  })
  const safeDisplay = Math.max(1, displayTotalMs)

  const compressRegionsDisplay: TimelineCompressRegionDisplay[] = interiors.map((i) => {
    const d0 = wallToDisplay(i.wallStart)
    const d1 = wallToDisplay(i.wallEnd)
    const omittedWallMs = i.wallEnd - i.wallStart
    return {
      pctLeft: Math.min(100, Math.max(0, (d0 / safeDisplay) * 100)),
      pctWidth: Math.min(100, Math.max(0, ((d1 - d0) / safeDisplay) * 100)),
      omittedWallMs,
    }
  })

  const rows: RunTimelineStepDisplayLayout[] = []

  for (const step of p.steps) {
    if (!step.hasTimelineBar) {
      rows.push({ step, pctStart: 0, pctWidth: 0, compression: null })
      continue
    }

    const d0 = wallToDisplay(step.startMs)
    const d1 = wallToDisplay(step.startMs + step.durationMs)
    const pctStartRaw = (d0 / safeDisplay) * 100
    const pctStart = Math.min(100, Math.max(0, pctStartRaw))
    const pctWidthRaw = ((d1 - d0) / safeDisplay) * 100
    const pctWidthCap = Math.max(0, 100 - pctStart)
    const pctWidth = Math.min(Math.max(pctWidthRaw, 0.45), pctWidthCap)

    let compression: RunTimelineStepDisplayLayout["compression"] = null

    if (
      p.compressLongSteps &&
      step.hasTimelineBar &&
      step.durationMs > LONG_STEP_TIMELINE_COMPRESS_THRESHOLD_MS
    ) {
      const edge = LONG_STEP_TIMELINE_COMPRESS_EDGE_MS
      const omittedWallMs = step.durationMs - 2 * edge
      if (omittedWallMs > 0) {
        const atEdgeL = wallToDisplay(step.startMs + edge)
        const atEdgeR = wallToDisplay(step.startMs + step.durationMs - edge)
        const dl = atEdgeL - d0
        const dr = d1 - atEdgeR
        const denom = dl + dr
        if (denom > 0 && atEdgeR > atEdgeL) {
          compression = {
            leftFlex: dl / denom,
            rightFlex: dr / denom,
            omittedWallMs,
          }
        }
      }
    }

    rows.push({ step, pctStart, pctWidth, compression })
  }

  return { displayTotalMs: safeDisplay, rows, compressRegionsDisplay }
}
