import type { NodeInputField } from "@/lib/workflows/engine/input-schema"
import { createEmptyNodeInputField } from "@/lib/workflows/engine/input-schema"

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
