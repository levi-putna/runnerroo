/**
 * Entry step execution — resolves the trigger's declared fields (persisted as `inputSchema`) and
 * optional `globalsSchema` against the trigger envelope.
 * Used for invoke, webhook, and schedule triggers (webhook/schedule re-export this module).
 */

import type { Node } from "@xyflow/react"

import type { NodeInputField } from "@/lib/workflows/engine/input-schema"
import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import { isUnsetSchemaText } from "@/lib/workflows/engine/schema-mapping-merge"
import {
  buildResolutionContext,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
} from "@/lib/workflows/engine/template"

/**
 * Trigger rows are authored as `inputSchema` because the first node conceptually receives the
 * invoke / webhook / schedule envelope as inputs. At execution time those same rows are evaluated with
 * {@link resolveOutputSchemaFields} — identical coercion and resolution to every other step's
 * outbound `outputSchema` — so downstream steps always consume the trigger as `{{input.*}}` like
 * any predecessor's output.
 *
 * When both legacy `outputSchema` and `inputSchema` exist on disk, blank value cells on `inputSchema`
 * inherit the mapping text from the legacy output row for the same key (older editor kept the lists
 * in sync separately).
 */
function buildEntryMappingRowsForResolution({
  inputSchema,
  legacyOutputSchema,
}: {
  inputSchema: NodeInputField[]
  legacyOutputSchema: NodeInputField[]
}): NodeInputField[] {
  if (inputSchema.length === 0) {
    return legacyOutputSchema
  }
  if (legacyOutputSchema.length === 0) {
    return inputSchema
  }

  const legacyByKey = new Map(legacyOutputSchema.map((field) => [field.key, field]))
  return inputSchema.map((field) => {
    const legacy = legacyByKey.get(field.key)
    const hasOwnValue =
      field.value !== undefined && !isUnsetSchemaText({ value: field.value })

    if (hasOwnValue) {
      return field
    }

    const legacyValue = legacy?.value
    if (legacyValue !== undefined && !isUnsetSchemaText({ value: legacyValue })) {
      return { ...field, value: legacyValue }
    }

    return field
  })
}

/**
 * Rows without a mapping expression default to `{{input.<key>}}` so each declared key passes
 * through from the trigger envelope under the same name (same default the old Output schema
 * import applied when merging from payload rows).
 */
function withDefaultEntryMappingTemplates({ rows }: { rows: NodeInputField[] }): NodeInputField[] {
  return rows.map((field) => {
    if (field.value !== undefined && !isUnsetSchemaText({ value: field.value })) {
      return field
    }
    return { ...field, value: `{{input.${field.key}}}` }
  })
}

/**
 * Evaluates an entry node's outbound field list against the trigger envelope and optional globals schema.
 *
 * Declared rows are resolved through {@link resolveOutputSchemaFields} so number / boolean / json
 * fields are coerced consistently with every other step.
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

  const inputSchemaRaw = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const legacyOutputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })

  const mappingRows = buildEntryMappingRowsForResolution({
    inputSchema: inputSchemaRaw,
    legacyOutputSchema,
  })

  // Trigger payload + standard tags (`{{input.*}}`, `{{now.*}}`, etc.).
  // `role: "entry"` keeps `{{input.*}}` bound to the workflow invoke payload (the trigger has
  // no predecessor — its job is to publish the initial values for the rest of the graph).
  const context = buildResolutionContext({ stepInput, stepId: node.id, role: "entry" })

  const rowsForResolution = withDefaultEntryMappingTemplates({ rows: mappingRows })
  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema: rowsForResolution, context })

  /**
   * Passthrough behaviour: when the author has not declared any payload field rows, surface the entire
   * trigger invoke object on the emitted output so the next step receives those keys via
   * `{{input.*}}` without per-key mapping. Once rows exist, only declared keys are emitted (each
   * blank mapping defaults to `{{input.key}}` — see {@link withDefaultEntryMappingTemplates}).
   */
  const triggerInputsForPassthrough = (() => {
    const envelope =
      stepInput && typeof stepInput === "object" ? (stepInput as Record<string, unknown>) : {}
    const ti = envelope.trigger_inputs
    return ti && typeof ti === "object" && !Array.isArray(ti)
      ? (ti as Record<string, unknown>)
      : {}
  })()

  const passthrough = mappingRows.length === 0 ? triggerInputsForPassthrough : {}

  const output: Record<string, unknown> = {
    kind: "entry_output",
    label,
    ok: true,
    ...passthrough,
    ...resolvedOutputs,
  }

  // Globals only appear on the payload when at least one row is mapped — keeps
  // the persisted run record tidy for triggers that don't use them.
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context })
  if (Object.keys(resolvedGlobals).length > 0) {
    output.globals = resolvedGlobals
  }

  return output
}
