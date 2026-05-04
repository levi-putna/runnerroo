import type { Node } from "@xyflow/react"
import type { Edge } from "@xyflow/react"
import type { NodeInputField, NodeInputFieldType } from "@/lib/workflow/input-schema"
import { createEmptyNodeInputField, readInputSchemaFromNodeData } from "@/lib/workflow/input-schema"
import { isUnsetSchemaText } from "@/lib/workflow/schema-mapping-merge"

export interface ListInboundSourcesParams {
  edges: Edge[]
  targetNodeId: string
}

/**
 * Returns distinct source node ids for edges whose target is the given step.
 */
export function listInboundSourcesForNode({ edges, targetNodeId }: ListInboundSourcesParams): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of edges) {
    if (e.target !== targetNodeId) continue
    if (seen.has(e.source)) continue
    seen.add(e.source)
    out.push(e.source)
  }
  out.sort((a, b) => a.localeCompare(b))
  return out
}

export interface TemplatePrevPathParams {
  /** Dotted segments after `prev`, e.g. `text` for `prev.text`; omit for the entire upstream payload. */
  path?: string
}

/**
 * Builds a `{{prev}}` or `{{prev.segment...}}` placeholder for input field mapping values.
 * The runner binds `prev` to the selected inbound edge’s predecessor output (never other steps by id).
 */
export function templatePrevPath({ path }: TemplatePrevPathParams): string {
  const inner = path && path.trim() ? `prev.${path.trim()}` : "prev"
  return `{{${inner}}}`
}

export interface InferredImportField {
  key: string
  label: string
  type: NodeInputFieldType
  /** Tag expression merged into the row `value` on the target step. */
  suggestedValue: string
}

export interface InferPreviousStepOutputFieldsParams {
  previousNode: Node
}

/**
 * Best-effort shape of a predecessor step's runtime output for wiring the next step's `inputSchema` values.
 * Entry nodes prefer a non-empty `outputSchema`, then fall back to `inputSchema`; AI steps prefer `outputSchema` keys when set, otherwise default to `prev.text`; other kinds default to the whole body.
 */
export function inferPreviousStepOutputFields({
  previousNode,
}: InferPreviousStepOutputFieldsParams): InferredImportField[] {
  if (previousNode.type === "entry") {
    const data = previousNode.data as Record<string, unknown>
    const fromOutput = readInputSchemaFromNodeData({ value: data?.outputSchema })
    const declared =
      fromOutput.length > 0
        ? fromOutput
        : readInputSchemaFromNodeData({
            value: data?.inputSchema,
          })
    if (declared.length === 0) {
      return [
        {
          key: "previous_output",
          label: "Trigger output",
          type: "text",
          suggestedValue: templatePrevPath({}),
        },
      ]
    }
    return declared.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      suggestedValue: templatePrevPath({ path: f.key }),
    }))
  }

  if (previousNode.type === "ai") {
    const data = previousNode.data as Record<string, unknown>
    const fromOutput = readInputSchemaFromNodeData({ value: data?.outputSchema })
    if (fromOutput.length > 0) {
      return fromOutput.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        suggestedValue: templatePrevPath({ path: f.key }),
      }))
    }
    return [
      {
        key: "text",
        label: "Generated text",
        type: "text",
        suggestedValue: templatePrevPath({ path: "text" }),
      },
    ]
  }

  if (previousNode.type === "random" || previousNode.type === "iteration") {
    const data = previousNode.data as Record<string, unknown>
    const fromOutput = readInputSchemaFromNodeData({ value: data?.outputSchema })
    if (fromOutput.length > 0) {
      return fromOutput.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        suggestedValue: templatePrevPath({ path: f.key }),
      }))
    }
    if (previousNode.type === "random") {
      return [
        {
          key: "random_number",
          label: "Random number",
          type: "number",
          suggestedValue: templatePrevPath({ path: "random_number" }),
        },
      ]
    }
    return [
      {
        key: "number",
        label: "Number",
        type: "number",
        suggestedValue: templatePrevPath({ path: "number" }),
      },
    ]
  }

  return [
    {
      key: "previous_output",
      label: "Previous step output",
      type: "text",
      suggestedValue: templatePrevPath({}),
    },
  ]
}

export interface MergeInputSchemaWithPreviousStepImportParams {
  existingFields: NodeInputField[]
  inferred: InferredImportField[]
  /**
   * When true (default), keeps any non-blank stored `value` on an existing row instead of replacing it with the inferred placeholder.
   */
  preserveNonEmptyValues?: boolean
}

/**
 * Merges inferred placeholders into the current input schema: updates matching keys in place and appends new keys.
 */
export function mergeInputSchemaWithPreviousStepImport({
  existingFields,
  inferred,
  preserveNonEmptyValues = true,
}: MergeInputSchemaWithPreviousStepImportParams): NodeInputField[] {
  const inferredByKey = new Map(inferred.map((f) => [f.key, f]))
  const consumed = new Set<string>()

  const updated: NodeInputField[] = existingFields.map((field) => {
    const match = inferredByKey.get(field.key)
    if (!match) return field
    consumed.add(field.key)
    const nextValue =
      preserveNonEmptyValues && !isUnsetSchemaText({ value: field.value }) ? field.value : match.suggestedValue
    return {
      ...field,
      value: nextValue,
    }
  })

  for (const inf of inferred) {
    if (consumed.has(inf.key)) continue
    updated.push(
      createEmptyNodeInputField({
        partial: {
          key: inf.key,
          label: inf.label,
          type: inf.type,
          value: inf.suggestedValue,
        },
      }),
    )
  }

  return updated
}
