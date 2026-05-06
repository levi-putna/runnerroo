import type { Edge } from "@xyflow/react"
import type { NodeResult } from "@/lib/workflows/engine/types"
import { readPredecessorNodeIdFromRunStepInput } from "@/lib/workflows/engine/runner"

/**
 * Derives which graph edges were traversed in a run by pairing each {@link NodeResult} with its
 * `input` envelope `predecessor.node_id` (set by the runner). Handles split branches (multiple
 * outbound edges from the same predecessor).
 */
export function computeRunTraversedReactFlowEdgeIds({
  edges,
  runState,
}: {
  edges: Edge[]
  runState: Map<string, NodeResult>
}): Set<string> {
  const out = new Set<string>()
  for (const [nodeId, result] of runState) {
    if (result.status === "skipped" || result.status === "pending") continue
    const pred = readPredecessorNodeIdFromRunStepInput({ stepInput: result.input })
    if (!pred) continue
    const matches = edges.filter((e) => e.source === pred && e.target === nodeId)
    if (matches.length === 0) continue
    if (matches.length === 1) {
      out.add(matches[0].id)
      continue
    }
    const sorted = [...matches].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    out.add(sorted[0].id)
  }
  return out
}
