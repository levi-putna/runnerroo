import type { Node } from "@xyflow/react"
import type { Edge } from "@xyflow/react"
import type { NodeInputField, NodeInputFieldType } from "@/lib/workflows/engine/input-schema"
import {
  createEmptyNodeInputField,
  readInputSchemaFromNodeData,
} from "@/lib/workflows/engine/input-schema"
import { isUnsetSchemaText } from "@/lib/workflows/engine/schema-mapping-merge"

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
  /** Dotted segments after `input`, e.g. `text` for `input.text`; omit for the entire upstream payload. */
  path?: string
}

/**
 * Builds an `{{input}}` or `{{input.segment...}}` placeholder for output / mapping cell values.
 *
 * Standard steps automatically receive the predecessor's emitted output as `{{input.*}}`, so
 * import tooling now writes `input.*` placeholders instead of the legacy `prev.*` form (the
 * runner still resolves persisted `{{prev.*}}` tags via a back-compat alias).
 */
export function templatePrevPath({ path }: TemplatePrevPathParams): string {
  const inner = path && path.trim() ? `input.${path.trim()}` : "input"
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
 * Entry nodes prefer `inputSchema` rows (same keys the trigger exposes downstream); legacy graphs may only have `outputSchema`.
 * AI and document steps use declared `outputSchema` keys as `{{input.<key>}}` (aligned with {@link readPredecessorOutputFromEnvelope}, which flattens emitted `outputs` onto the `input` namespace for the next hop).
 * Other kinds follow the same flat `input.<key>` convention where a single key applies; otherwise default to `{{input}}` for the whole payload.
 */
export function inferPreviousStepOutputFields({
  previousNode,
}: InferPreviousStepOutputFieldsParams): InferredImportField[] {
  if (previousNode.type === "entry") {
    const data = previousNode.data as Record<string, unknown>
    const fromInput = readInputSchemaFromNodeData({ value: data?.inputSchema })
    const fromLegacyOutput = readInputSchemaFromNodeData({ value: data?.outputSchema })
    const declared =
      fromInput.length > 0
        ? fromInput
        : fromLegacyOutput
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

  if (previousNode.type === "decision") {
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
    // Fallback when no output schema is defined — expose the condition result only.
    return [
      {
        key: "decision_result",
        label: "Decision result",
        type: "boolean" as NodeInputFieldType,
        suggestedValue: templatePrevPath({ path: "decision_result" }),
      },
    ]
  }

  if (previousNode.type === "approval") {
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
    // Fallback when no output schema is defined — expose the approval decision.
    return [
      {
        key: "decision",
        label: "Decision",
        type: "text" as NodeInputFieldType,
        suggestedValue: templatePrevPath({ path: "decision" }),
      },
    ]
  }

  if (previousNode.type === "switch") {
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
    // Fallback when no output schema is defined — expose routing outcome only.
    return [
      {
        key: "switch_matched_case_id",
        label: "Matched case id",
        type: "text" as NodeInputFieldType,
        suggestedValue: templatePrevPath({ path: "switch_matched_case_id" }),
      },
      {
        key: "switch_used_default",
        label: "Used default (Else) branch",
        type: "boolean" as NodeInputFieldType,
        suggestedValue: templatePrevPath({ path: "switch_used_default" }),
      },
    ]
  }

  if (previousNode.type === "split") {
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
        key: "split_fanout_count",
        label: "Parallel path count",
        type: "number" as NodeInputFieldType,
        suggestedValue: templatePrevPath({ path: "split_fanout_count" }),
      },
    ]
  }

  if (previousNode.type === "document") {
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
    // Fallback to the known default document output keys
    return [
      {
        key: "file_name",
        label: "File name",
        type: "text" as NodeInputFieldType,
        suggestedValue: templatePrevPath({ path: "file_name" }),
      },
      {
        key: "document_url",
        label: "Document URL",
        type: "text" as NodeInputFieldType,
        suggestedValue: templatePrevPath({ path: "document_url" }),
      },
    ]
  }

  if (previousNode.type === "end") {
    const data = previousNode.data as Record<string, unknown>
    const fromOutput = readInputSchemaFromNodeData({ value: data?.outputSchema })
    const rows =
      fromOutput.length > 0
        ? fromOutput
            .filter((f) => f.key !== "success")
            .map((f) => ({
              key: f.key,
              label: f.label,
              type: f.type,
              suggestedValue: templatePrevPath({ path: f.key }),
            }))
        : []
    if (rows.length > 0) {
      return rows
    }
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

export interface ReplaceInputSchemaWithPreviousStepImportParams {
  inferred: InferredImportField[]
}

/**
 * Rebuilds the inbound field list solely from inferred upstream keys (replace semantics).
 */
export function replaceInputSchemaWithPreviousStepImport({
  inferred,
}: ReplaceInputSchemaWithPreviousStepImportParams): NodeInputField[] {
  return inferred.map((inf) =>
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
