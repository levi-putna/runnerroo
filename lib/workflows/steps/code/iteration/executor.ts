/**
 * Iteration step — starting number plus configurable increment.
 */

import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  parseFiniteNumberFromResolved,
  resolveDeclaredInputsMap,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
  resolveTemplate,
} from "@/lib/workflows/engine/template"

export function executeIterationStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Record<string, unknown> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  const context = buildResolutionContext({ stepInput, stepId: node.id })
  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const resolvedInputs = resolveDeclaredInputsMap({ inputSchema, context })

  const rawStart = resolvedInputs.starting_number
  if (rawStart === undefined) {
    throw new Error(
      'Add an input schema row with key "starting_number" and a mapped value before running this step.',
    )
  }
  const startNum = parseFiniteNumberFromResolved({
    text: rawStart,
    fieldLabel: 'Input "starting_number"',
  })

  const incrementTemplateRaw =
    typeof data?.iterationIncrement === "string" ? data.iterationIncrement : "1"
  const incrementTemplate = incrementTemplateRaw.trim() === "" ? "1" : incrementTemplateRaw.trim()
  const incrementResolvedStr = resolveTemplate(incrementTemplate, context)
  let increment = Number(incrementResolvedStr.trim())
  if (!Number.isFinite(increment)) {
    increment = 1
  }

  const nextNumber = startNum + increment

  const exeContext: Record<string, unknown> = { number: nextNumber }
  const outputContext = { ...context, exe: exeContext }
  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema, context: outputContext })

  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "iteration",
    node_id: node.id,
    label,
    ok: true,
    ...resolvedOutputs,
    outputs: resolvedOutputs,
    exe: exeContext,
    inputs: resolvedInputs,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
