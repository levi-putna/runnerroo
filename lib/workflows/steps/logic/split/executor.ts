import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
} from "@/lib/workflows/engine/template"

/**
 * Reads configured split paths from node data — matches the editor’s `readSplitPaths` normalisation
 * (at least one path id when the array is missing or invalid).
 */
function readSplitPathsFromNodeData({
  data,
}: {
  data: Record<string, unknown> | undefined
}): { id: string }[] {
  const raw = data?.paths
  if (Array.isArray(raw) && raw.length > 0) {
    const mapped = raw
      .map((p) => ({
        id: typeof (p as { id?: unknown })?.id === "string" ? String((p as { id: string }).id).trim() : "",
      }))
      .filter((p) => p.id.length > 0)
    if (mapped.length > 0) return mapped
  }
  return [{ id: "sp-a" }]
}

/**
 * Emits a pass-through result for a fan-out step: no routing conditions — every outbound path receives
 * the same downstream payload from the runner. Exposes `split_fanout_count` in `exe` for
 * `{{exe.split_fanout_count}}` output mappings, and resolves `outputSchema` / `globalsSchema` like
 * other logic steps.
 */
export async function executeSplitStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput?: unknown
}): Promise<Record<string, unknown>> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id

  const paths = readSplitPathsFromNodeData({ data })
  const splitFanoutCount = paths.length

  const context = buildResolutionContext({ stepInput: stepInput ?? {}, stepId: node.id })
  const exeContext: Record<string, unknown> = { split_fanout_count: splitFanoutCount }
  const outputContext = { ...context, exe: exeContext }

  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema, context: outputContext })

  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "split",
    node_id: node.id,
    label,
    ok: true,
    ...resolvedOutputs,
    outputs: resolvedOutputs,
    exe: exeContext,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
