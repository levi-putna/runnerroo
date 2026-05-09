/**
 * Random number step — draws uniformly between resolved min and max.
 */

import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  drawUniformInclusiveBetween,
  parseFiniteNumberFromResolved,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
  resolveTemplate,
} from "@/lib/workflows/engine/template"

export function executeRandomNumberStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Record<string, unknown> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  const context = buildResolutionContext({ stepInput, stepId: node.id })

  const minExpression = typeof data?.randomMinExpression === "string" ? data.randomMinExpression : "0"
  const maxExpression = typeof data?.randomMaxExpression === "string" ? data.randomMaxExpression : "100"
  const min = parseFiniteNumberFromResolved({
    text: resolveTemplate(minExpression, context),
    fieldLabel: 'Execution "Minimum"',
  })
  const max = parseFiniteNumberFromResolved({
    text: resolveTemplate(maxExpression, context),
    fieldLabel: 'Execution "Maximum"',
  })
  const drawn = drawUniformInclusiveBetween({ min, max })

  const exeContext: Record<string, unknown> = { number: drawn }
  const outputContext = { ...context, exe: exeContext }
  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema, context: outputContext })

  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "random",
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
