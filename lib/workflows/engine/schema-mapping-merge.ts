import type { NodeInputField, NodeInputFieldType } from "@/lib/workflows/engine/input-schema"
import { createEmptyNodeInputField } from "@/lib/workflows/engine/input-schema"
import type { ExtractFieldRow } from "@/lib/workflows/steps/ai/extract/defaults"

export interface IsUnsetSchemaTextParams {
  value: string | undefined
}

/**
 * True when a schema value slot is absent or only whitespace.
 */
export function isUnsetSchemaText({ value }: IsUnsetSchemaTextParams): boolean {
  return value === undefined || value.trim() === ""
}

export interface MergeEntryOutputFromInputParams {
  existingOutputFields: NodeInputField[]
  inputFields: NodeInputField[]
}

/**
 * Mirrors the trigger input schema into output rows: same keys and metadata, with
 * `{{input.<key>}}` as the value where the output row had no value yet.
 *
 * Output-only keys (not present on the input schema) are appended unchanged at the end.
 */
export function mergeEntryOutputSchemaFromInputFields({
  existingOutputFields,
  inputFields,
}: MergeEntryOutputFromInputParams): NodeInputField[] {
  const mappedValueForKey = ({ key }: { key: string }) => `{{input.${key}}}`

  const existingByKey = new Map(existingOutputFields.map((field) => [field.key, field]))
  const consumedKeys = new Set<string>()

  const mergedLeading: NodeInputField[] = inputFields.map((src) => {
    consumedKeys.add(src.key)
    const prev = existingByKey.get(src.key)

    if (!prev) {
      const initialValue: string =
        src.value !== undefined && !isUnsetSchemaText({ value: src.value }) ? src.value : mappedValueForKey({ key: src.key })
      return createEmptyNodeInputField({
        partial: {
          key: src.key,
          label: src.label,
          type: src.type,
          required: src.required,
          description: src.description,
          value: initialValue,
        },
      })
    }

    let nextValue: string | undefined
    if (!isUnsetSchemaText({ value: prev.value })) {
      nextValue = prev.value
    } else if (!isUnsetSchemaText({ value: src.value })) {
      nextValue = src.value
    } else {
      nextValue = mappedValueForKey({ key: src.key })
    }

    return {
      ...prev,
      label: src.label,
      type: src.type,
      required: src.required,
      description: src.description,
      value: nextValue,
    }
  })

  const tail = existingOutputFields.filter((field) => !consumedKeys.has(field.key))
  return [...mergedLeading, ...tail]
}

export interface MergeExtractOutputFromFieldsParams {
  existingOutputFields: NodeInputField[]
  extractFields: ExtractFieldRow[]
}

/**
 * Mirrors declared extraction fields into output rows: same key, label, type, required flag,
 * and description, with `{{exe.<key>}}` as the default value where the output row had no value yet.
 *
 * Output-only keys (not present in extractFields) are appended unchanged at the end so any
 * manually added rows (e.g. for telemetry like `{{exe.usage.totalTokens}}`) are preserved.
 */
export function mergeExtractOutputSchemaFromExtractFields({
  existingOutputFields,
  extractFields,
}: MergeExtractOutputFromFieldsParams): NodeInputField[] {
  const mappedValueForKey = ({ key }: { key: string }) => `{{exe.${key}}}`

  const existingByKey = new Map(existingOutputFields.map((f) => [f.key, f]))
  const consumedKeys = new Set<string>()

  const mergedLeading: NodeInputField[] = extractFields.map((src) => {
    consumedKeys.add(src.key)
    const prev = existingByKey.get(src.key)

    if (!prev) {
      return createEmptyNodeInputField({
        partial: {
          key: src.key,
          label: src.label || src.key,
          type: src.type,
          required: src.required,
          description: src.description,
          value: mappedValueForKey({ key: src.key }),
        },
      })
    }

    // Keep any existing mapping value; only insert placeholder when the cell is blank.
    const nextValue =
      !isUnsetSchemaText({ value: prev.value }) ? prev.value : mappedValueForKey({ key: src.key })

    return {
      ...prev,
      label: src.label || src.key,
      type: src.type,
      required: src.required,
      description: src.description,
      value: nextValue,
    }
  })

  const tail = existingOutputFields.filter((f) => !consumedKeys.has(f.key))
  return [...mergedLeading, ...tail]
}

/**
 * Describes one downstream output row mirrored from Generate document runtime `exe` fields.
 *
 * Keys are authoring-facing (`file_name`, …); `mappingValue` points at camelCase props on `exe`.
 */
export interface DocumentGenerateExecutionOutputSpecRow {
  key: string
  label: string
  type: NodeInputFieldType
  description: string
  /** Resolved after upload — e.g. `{{exe.documentUrl}}`. */
  mappingValue: string
}

/**
 * Canonical execution outputs for Generate document steps, in merge order for "Import from execution".
 */
export const DOCUMENT_GENERATE_EXECUTION_IMPORT_SPECS: readonly DocumentGenerateExecutionOutputSpecRow[] = [
  {
    key: "file_name",
    label: "File name",
    type: "string",
    description:
      "Generated filename (.docx), matching the Execution tab output name or step default.",
    mappingValue: "{{exe.outputFileName}}",
  },
  {
    key: "document_url",
    label: "Document URL",
    type: "string",
    description: "Fully qualified signed URL callers can open to download the generated document.",
    mappingValue: "{{exe.documentUrl}}",
  },
  {
    key: "storage_path",
    label: "Storage path",
    type: "string",
    description: "Object key within the workflow document outputs bucket (not a browser URL).",
    mappingValue: "{{exe.outputPath}}",
  },
  {
    key: "output_bucket",
    label: "Output bucket",
    type: "string",
    description: "Supabase Storage bucket hosting the uploaded .docx.",
    mappingValue: "{{exe.outputBucket}}",
  },
  {
    key: "template_id",
    label: "Template id",
    type: "string",
    description: "Registered template row used to render this run.",
    mappingValue: "{{exe.templateFileId}}",
  },
  {
    key: "template_name",
    label: "Template name",
    type: "string",
    description: "Human-readable template label from registry metadata.",
    mappingValue: "{{exe.templateName}}",
  },
]

export interface MergeGenerateDocumentOutputFromExecutionParams {
  existingOutputFields: NodeInputField[]
  /** Rows to merge — defaults to {@link DOCUMENT_GENERATE_EXECUTION_IMPORT_SPECS}. */
  executionSpecs?: readonly DocumentGenerateExecutionOutputSpecRow[]
}

/**
 * Mirrors Generate document execution fields into outbound mapping rows (`mappingValue` per spec).
 *
 * Rows that already have mapping text stay unchanged unless the cell was blank — same semantics as extraction sync.
 */
export function mergeGenerateDocumentOutputFromExecutionFields({
  existingOutputFields,
  executionSpecs = DOCUMENT_GENERATE_EXECUTION_IMPORT_SPECS,
}: MergeGenerateDocumentOutputFromExecutionParams): NodeInputField[] {
  const existingByKey = new Map(existingOutputFields.map((f) => [f.key, f]))
  const consumedKeys = new Set<string>()

  const mergedLeading: NodeInputField[] = executionSpecs.map((spec) => {
    consumedKeys.add(spec.key)
    const prev = existingByKey.get(spec.key)

    if (!prev) {
      return createEmptyNodeInputField({
        partial: {
          key: spec.key,
          label: spec.label,
          type: spec.type,
          required: false,
          description: spec.description,
          value: spec.mappingValue,
        },
      })
    }

    const nextValue =
      !isUnsetSchemaText({ value: prev.value }) ? prev.value : spec.mappingValue

    return {
      ...prev,
      label: spec.label,
      type: spec.type,
      description: spec.description,
      value: nextValue,
    }
  })

  const tail = existingOutputFields.filter((f) => !consumedKeys.has(f.key))
  return [...mergedLeading, ...tail]
}
