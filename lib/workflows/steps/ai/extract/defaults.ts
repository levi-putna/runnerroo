/**
 * Defaults and persistence helpers for Extract step field rows.
 */

export const AI_EXTRACT_OPTIONAL_GUIDANCE_PLACEHOLDER =
  "Optional: formatting rules, fallback behaviour, or domain context. The step already enforces one structured JSON object per field."

function newExtractFieldRowId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `extract-field-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Supported primitive types for an extraction field (mirrors NodeInputFieldType). */
export type ExtractFieldType = "string" | "number" | "boolean" | "text"

export const EXTRACT_FIELD_TYPES: ExtractFieldType[] = ["string", "text", "number", "boolean"]

export interface ExtractFieldRow {
  /** Stable id for React keys and drag–reorder. */
  id: string
  /**
   * Programmatic key used in `exe.<key>` and the output schema.
   * Same character rules as NodeInputField.key: letters, digits, `-`, `_`.
   */
  key: string
  /** Human-readable label shown in the editor and injected as context into the model prompt. */
  label: string
  /** Primitive output type — used to build the Zod schema property. */
  type: ExtractFieldType
  /**
   * Whether the model must return a non-null value.
   * Required fields compile to non-nullable Zod types; optional to `.nullable().optional()`.
   */
  required: boolean
  /**
   * What the model should look for. Strongly recommended: the model uses this to identify the field.
   */
  description: string
}

export interface CreateEmptyExtractFieldRowParams {
  partial?: Partial<Pick<ExtractFieldRow, "key" | "label" | "type" | "required" | "description">>
}

/**
 * Creates a new extract field row with a fresh stable id.
 */
export function createEmptyExtractFieldRow({
  partial,
}: CreateEmptyExtractFieldRowParams = {}): ExtractFieldRow {
  return {
    id: newExtractFieldRowId(),
    key: partial?.key ?? "",
    label: partial?.label ?? "",
    type: partial?.type ?? "string",
    required: partial?.required ?? false,
    description: partial?.description ?? "",
  }
}

/**
 * New Extract nodes start with no field rows — authors add only what they need.
 */
export function buildDefaultExtractFieldRows(): ExtractFieldRow[] {
  return []
}

export interface ReadExtractFieldRowsFromNodeDataParams {
  value: unknown
}

/**
 * Reads `node.data.extractFields` from the persisted graph into normalised rows.
 */
export function readExtractFieldRowsFromNodeData({
  value,
}: ReadExtractFieldRowsFromNodeDataParams): ExtractFieldRow[] {
  if (!Array.isArray(value)) return []
  const out: ExtractFieldRow[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : newExtractFieldRowId()
    const key = typeof o.key === "string" ? o.key.trim() : ""
    if (!key) continue
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : key
    const typeRaw = typeof o.type === "string" ? o.type : ""
    const type: ExtractFieldType = (EXTRACT_FIELD_TYPES as string[]).includes(typeRaw)
      ? (typeRaw as ExtractFieldType)
      : "string"
    const required = Boolean(o.required)
    const description = typeof o.description === "string" ? o.description.trim() : ""
    out.push({ id, key, label, type, required, description })
  }
  return out
}
