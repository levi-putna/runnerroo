import type { Node } from "@xyflow/react"

import {
  readInputSchemaFromNodeData,
  type NodeInputField,
} from "@/lib/workflows/engine/input-schema"
import { buildResolutionContext, resolveTemplate } from "@/lib/workflows/engine/template"

/** Canonical key always set on End step output — callers must not rely on declaring it in `outputSchema`. */
export const END_STEP_SUCCESS_FIELD = "success" as const

interface CoerceEndOutputFieldParams {
  field: NodeInputField
  resolvedText: string
}

/**
 * Coerces a single resolved mapping cell into a JSON value for the public End output object.
 */
function coerceEndOutputFieldValue({ field, resolvedText }: CoerceEndOutputFieldParams): unknown | undefined {
  const trimmed = resolvedText.trim()
  if (field.type === "boolean") {
    if (trimmed === "") return undefined
    const s = trimmed.toLowerCase()
    if (s === "true") return true
    if (s === "false") return false
    return undefined
  }
  if (field.type === "number") {
    if (trimmed === "") return undefined
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : undefined
  }
  return resolvedText
}

/**
 * Builds the public record that downstream consumers (including assistant workflow tools) may see.
 * Maps each `outputSchema` row through the runner envelope (`{{prev.*}}`, `{{input.*}}`, etc.), then
 * applies {@link END_STEP_SUCCESS_FIELD} last so it cannot be overridden from the editor.
 */
export function buildEndStepPublicOutput({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Record<string, unknown> {
  const data = node.data as Record<string, unknown> | undefined
  const fields = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const context = buildResolutionContext(stepInput)
  const out: Record<string, unknown> = {}

  for (const field of fields) {
    if (field.key === END_STEP_SUCCESS_FIELD) {
      continue
    }
    if (!field.value?.trim()) {
      continue
    }
    const resolved = resolveTemplate(field.value, context)
    const coerced = coerceEndOutputFieldValue({ field, resolvedText: resolved })
    if (coerced !== undefined) {
      out[field.key] = coerced
    }
  }

  out[END_STEP_SUCCESS_FIELD] = true
  return out
}

/**
 * End nodes terminate the branch; the returned object is the only workflow payload meant for
 * assistant tool surfaces when this node is reached.
 */
export async function executeEndStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput?: unknown
}): Promise<Record<string, unknown>> {
  return buildEndStepPublicOutput({ node, stepInput: stepInput ?? null })
}
