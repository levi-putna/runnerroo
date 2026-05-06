import type { NodeInputField, NodeInputFieldType } from "@/lib/workflows/engine/input-schema"
import { createEmptyNodeInputField } from "@/lib/workflows/engine/input-schema"
import {
  approvalExePromptTags,
  classifyObjectExecutionPromptTags,
  generateTextExecutionPromptTags,
} from "@/lib/workflows/engine/prompt-tags"
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
 * Describes one downstream output row mirrored from Document from Template runtime `exe` fields.
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
 * Canonical execution outputs for Document from Template steps, in merge order for "Import from execution".
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

/**
 * Execution output specs for docxml-generated documents — omits template registry rows.
 */
export const DOCUMENT_XML_EXECUTION_IMPORT_SPECS: readonly DocumentGenerateExecutionOutputSpecRow[] = [
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
]

export interface MergeGenerateDocumentOutputFromExecutionParams {
  existingOutputFields: NodeInputField[]
  /** Rows to merge — defaults to {@link DOCUMENT_GENERATE_EXECUTION_IMPORT_SPECS}. */
  executionSpecs?: readonly DocumentGenerateExecutionOutputSpecRow[]
}

export interface MergeOutputSchemaFromExecutionSpecsParams {
  existingOutputFields: NodeInputField[]
  specs: readonly DocumentGenerateExecutionOutputSpecRow[]
}

/**
 * Mirrors known execution `exe.*` fields into outbound mapping rows (`mappingValue` per spec).
 *
 * Rows that already have mapping text stay unchanged unless the cell was blank — same semantics as extraction sync.
 */
export function mergeOutputSchemaFromExecutionSpecs({
  existingOutputFields,
  specs,
}: MergeOutputSchemaFromExecutionSpecsParams): NodeInputField[] {
  const existingByKey = new Map(existingOutputFields.map((f) => [f.key, f]))
  const consumedKeys = new Set<string>()

  const mergedLeading: NodeInputField[] = specs.map((spec) => {
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

/**
 * Mirrors Document from Template execution fields into outbound mapping rows (`mappingValue` per spec).
 *
 * Rows that already have mapping text stay unchanged unless the cell was blank — same semantics as extraction sync.
 */
export function mergeGenerateDocumentOutputFromExecutionFields({
  existingOutputFields,
  executionSpecs = DOCUMENT_GENERATE_EXECUTION_IMPORT_SPECS,
}: MergeGenerateDocumentOutputFromExecutionParams): NodeInputField[] {
  return mergeOutputSchemaFromExecutionSpecs({
    existingOutputFields,
    specs: executionSpecs,
  })
}

/** Turns `exe.a.b` style tag ids into stable output-schema keys (`a_b`). */
function exeTagIdToAuthoringKey({ id }: { id: string }): string {
  const trimmed = id.replace(/^exe\./, "")
  return trimmed.replace(/\./g, "_")
}

/** Best-effort output field type from execution tag id (token counts and lengths are numeric). */
function inferOutputFieldTypeForExecutionTag({ id }: { id: string }): NodeInputFieldType {
  const lower = id.toLowerCase()
  if (lower.includes("usage") || lower.endsWith(".length") || lower.includes("confidence")) {
    return "number"
  }
  if (id === "exe.ok") {
    return "boolean"
  }
  return "text"
}

/**
 * Execution-field rows for **Generate / transform / summarise** steps (`generateText` result shape).
 */
export function buildGenerateTextExecutionImportSpecs(): readonly DocumentGenerateExecutionOutputSpecRow[] {
  return generateTextExecutionPromptTags().map((t) => ({
    key: exeTagIdToAuthoringKey({ id: t.id }),
    label: t.label.replace(/^Execution · /, "").trim() || exeTagIdToAuthoringKey({ id: t.id }),
    type: inferOutputFieldTypeForExecutionTag({ id: t.id }),
    description: t.description,
    mappingValue: `{{${t.id}}}`,
  }))
}

/**
 * Execution-field rows for **Classify** steps (`exe.classifier_*` and shared telemetry).
 */
export function buildClassifyExecutionImportSpecs(): readonly DocumentGenerateExecutionOutputSpecRow[] {
  return classifyObjectExecutionPromptTags().map((t) => ({
    key: exeTagIdToAuthoringKey({ id: t.id }),
    label: t.label.replace(/^Execution · /, "").trim() || exeTagIdToAuthoringKey({ id: t.id }),
    type: inferOutputFieldTypeForExecutionTag({ id: t.id }),
    description: t.description,
    mappingValue: `{{${t.id}}}`,
  }))
}

/** Execution-field rows for **Approval** steps after a reviewer approves (`exe.decision`, `exe.responded_at`). */
export function buildApprovalExecutionImportSpecs(): readonly DocumentGenerateExecutionOutputSpecRow[] {
  return approvalExePromptTags().map((t) => ({
    key: exeTagIdToAuthoringKey({ id: t.id }),
    label: t.label.replace(/^Execution · /, "").trim() || exeTagIdToAuthoringKey({ id: t.id }),
    type: inferOutputFieldTypeForExecutionTag({ id: t.id }),
    description: t.description,
    mappingValue: `{{${t.id}}}`,
  }))
}

/** Canonical webhook HTTP execution outputs for "Import from execution". */
export const WEBHOOK_CALL_EXECUTION_IMPORT_SPECS: readonly DocumentGenerateExecutionOutputSpecRow[] = [
  {
    key: "status_code",
    label: "Status code",
    type: "number",
    description: "HTTP status code returned by the remote server.",
    mappingValue: "{{exe.status_code}}",
  },
  {
    key: "ok",
    label: "Response ok",
    type: "boolean",
    description: "True when the server returned a 2xx status code.",
    mappingValue: "{{exe.ok}}",
  },
]

export interface BuildNumericStepExecutionImportSpecsParams {
  /** Outbound key for the numeric result (`random_number` vs `number`). */
  resultKey: string
  /** Row label in the output schema editor. */
  resultLabel: string
}

/**
 * Single-row execution import for **Random number** and **Iteration** (`{{exe.number}}`).
 */
export function buildNumericStepExecutionImportSpecs({
  resultKey,
  resultLabel,
}: BuildNumericStepExecutionImportSpecsParams): readonly DocumentGenerateExecutionOutputSpecRow[] {
  return [
    {
      key: resultKey,
      label: resultLabel,
      type: "number",
      description: "Numeric result from this step after execution (random draw or starting value plus increment).",
      mappingValue: "{{exe.number}}",
    },
  ]
}
