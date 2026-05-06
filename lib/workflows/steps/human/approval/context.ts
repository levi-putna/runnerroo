import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
} from "@/lib/workflows/engine/template"

/**
 * Builds the template resolution map for an Approval step: inbound runner envelope plus values from
 * this step’s Input tab merged onto `input` / `trigger_inputs`, so `{{input.<key>}}` in the approval
 * message and output mappings sees declared fields.
 */
export function buildApprovalResolutionContext({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Record<string, unknown> {
  const base = buildResolutionContext({ stepInput, stepId: node.id })
  const data = node.data as Record<string, unknown> | undefined
  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })

  const resolvedStepInputs =
    inputSchema.length > 0 ? resolveOutputSchemaFields({ outputSchema: inputSchema, context: base }) : {}

  const trig = base.trigger_inputs
  const triggerRecord =
    trig && typeof trig === "object" && !Array.isArray(trig) ? { ...(trig as Record<string, unknown>) } : {}

  const mergedInputs = { ...triggerRecord, ...resolvedStepInputs }

  return {
    ...base,
    trigger_inputs: mergedInputs,
    input: mergedInputs,
  }
}

/**
 * Builds the step output persisted when an approval is granted: mapped output/globals rows plus `exe.*`
 * reviewer metadata for downstream `{{prev.*}}`.
 */
export function buildApprovedApprovalStepOutput({
  node,
  stepInput,
  exe,
}: {
  node: Node
  stepInput: unknown
  exe: { decision: "approved"; responded_at: string }
}): Record<string, unknown> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id

  const msgCtx = buildApprovalResolutionContext({ node, stepInput })
  const exeContext: Record<string, unknown> = {
    decision: exe.decision,
    responded_at: exe.responded_at,
  }
  const outputContext = { ...msgCtx, exe: exeContext }

  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })

  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema: outputSchema, context: outputContext })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema: globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "approval",
    node_id: node.id,
    label,
    ok: true,
    decision: exe.decision,
    responded_at: exe.responded_at,
    ...resolvedOutputs,
    outputs: resolvedOutputs,
    exe: exeContext,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
