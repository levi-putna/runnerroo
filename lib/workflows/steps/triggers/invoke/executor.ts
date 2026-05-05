/**
 * Entry step execution — resolves outputSchema and globalsSchema against the trigger envelope.
 */

import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  resolveGlobalsSchema,
  resolveTemplate,
} from "@/lib/workflows/engine/template"

/**
 * Evaluates an entry node's outputSchema against the trigger envelope and optional globals schema.
 */
export function executeEntryNode({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Record<string, unknown> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id

  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })

  const context = buildResolutionContext(stepInput)

  const output: Record<string, unknown> = {
    kind: "entry_output",
    label,
    ok: true,
  }

  for (const field of outputSchema) {
    if (!field.value) continue
    const resolved = resolveTemplate(field.value, context)
    output[field.key] = resolved
  }

  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context })
  if (Object.keys(resolvedGlobals).length > 0) {
    output.globals = resolvedGlobals
  }

  return output
}
