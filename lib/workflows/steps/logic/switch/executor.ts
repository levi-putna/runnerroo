import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import { planSwitchGate } from "@/lib/workflows/engine/evaluate-workflow-gate-expression"
import {
  buildResolutionContext,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
} from "@/lib/workflows/engine/template"

/**
 * Evaluates ordered switch case conditions and resolves `outputSchema` / `globalsSchema` mappings so
 * downstream steps can reference this step's output via `{{prev.*}}`.
 *
 * `switch_matched_case_id` and `switch_used_default` are always present in the `exe` context so
 * output mapping cells can reference `{{exe.switch_matched_case_id}}` and
 * `{{exe.switch_used_default}}`. Resolved output fields are spread at the top level
 * (for direct `{{prev.<key>}}` access) and also nested under `outputs` (for schema-aware consumers).
 */
export async function executeSwitchStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput?: unknown
}): Promise<Record<string, unknown>> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id

  const context = buildResolutionContext({ stepInput: stepInput ?? {}, stepId: node.id })

  const gatePlan = planSwitchGate({ node, stepInput: stepInput ?? {} })
  const caseId = gatePlan.ok ? gatePlan.plan.caseId : null
  const switchMatchedCaseId = caseId ?? ""
  const switchUsedDefault = !gatePlan.ok || caseId === null

  const exeContext: Record<string, unknown> = {
    switch_matched_case_id: switchMatchedCaseId,
    switch_used_default: switchUsedDefault,
  }
  const outputContext = { ...context, exe: exeContext }

  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema, context: outputContext })

  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "switch",
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
