import type { Node } from "@xyflow/react"

/**
 * Minimal successful step payload used before specialised behaviour exists for a type.
 */
export function buildStubOkStepOutput({ node }: { node: Node }): Record<string, unknown> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  const t = typeof node.type === "string" ? node.type : "unknown"
  return {
    kind: t !== "" ? t : "step_output",
    node_id: node.id,
    label,
    ok: true,
  }
}
