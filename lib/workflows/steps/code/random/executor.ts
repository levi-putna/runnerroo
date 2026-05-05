/**
 * Random number step — draws uniformly between resolved min and max.
 */

import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  drawUniformInclusiveBetween,
  parseFiniteNumberFromResolved,
  resolveDeclaredInputsMap,
  resolveGlobalsSchema,
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
  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const resolvedInputs = resolveDeclaredInputsMap({ inputSchema, context })

  const minStr = resolvedInputs.min ?? ""
  const maxStr = resolvedInputs.max ?? ""
  const min = parseFiniteNumberFromResolved({ text: minStr, fieldLabel: 'Input "min"' })
  const max = parseFiniteNumberFromResolved({ text: maxStr, fieldLabel: 'Input "max"' })
  const drawn = drawUniformInclusiveBetween({ min, max })

  const exeContext: Record<string, unknown> = { number: drawn }
  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs: Record<string, unknown> = {}
  const outputContext = { ...context, exe: exeContext }
  for (const field of outputSchema) {
    if (!field.value) continue
    resolvedOutputs[field.key] = resolveTemplate(field.value, outputContext)
  }

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
    inputs: resolvedInputs,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
