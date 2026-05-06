import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import { planDecisionGate } from "@/lib/workflows/engine/evaluate-workflow-gate-expression"
import {
  buildResolutionContext,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
} from "@/lib/workflows/engine/template"

/**
 * Evaluates the decision condition and resolves `outputSchema`/`globalsSchema` mappings so
 * downstream steps can reference this step's output via `{{prev.*}}`.
 *
 * `decision_result` is always present in the `exe` context so output mapping cells can
 * reference `{{exe.decision_result}}`. Resolved output fields are spread at the top level
 * (for direct `{{prev.<key>}}` access) and also nested under `outputs` (for schema-aware consumers).
 */
export async function executeDecisionStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput?: unknown
}): Promise<Record<string, unknown>> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id

  const context = buildResolutionContext({ stepInput: stepInput ?? {}, stepId: node.id })

  // Evaluate the gate condition to expose the boolean result in the exe context.
  const gatePlan = planDecisionGate({ node, stepInput: stepInput ?? {} })
  const decisionResult = gatePlan.ok ? gatePlan.plan.truthy : false

  const exeContext: Record<string, unknown> = { decision_result: decisionResult }
  const outputContext = { ...context, exe: exeContext }

  // Resolve output schema field mappings (e.g. {{input.*}}, {{prev.*}}, {{exe.decision_result}}).
  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema, context: outputContext })

  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "decision",
    node_id: node.id,
    label,
    ok: true,
    // Spread resolved fields at the top level for direct {{prev.<key>}} access.
    ...resolvedOutputs,
    outputs: resolvedOutputs,
    exe: exeContext,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
