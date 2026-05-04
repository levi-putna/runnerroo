/**
 * Typed input field definitions for workflow steps (similar to n8n node parameters
 * or Zapier inputFields). Used to declare what each step expects at runtime and
 * how to reference values in prompts or code via `{{input.key}}`.
 */

/** Supported primitive types for a declared input field. */
export type NodeInputFieldType = "string" | "number" | "boolean" | "text"

/** One field in a step's input schema. */
export interface NodeInputField {
  /** Stable id for list keys in the UI. */
  id: string
  /** Programmatic key (e.g. `customer_name`); referenced as `{{input.customer_name}}`. */
  key: string
  /** Human-readable label in the editor. */
  label: string
  type: NodeInputFieldType
  required: boolean
  description?: string
  /**
   * Literal or tag expression (`{{now.iso}}`, `{{input.other_key}}`, `{{prev.text}}`, booleans as `true`/`false` strings).
   * Serialised as JSON `value`; legacy `defaultValue` is still read when migrating.
   */
  value?: string
}

export interface ReadInputSchemaFromNodeDataParams {
  value: unknown
}

/**
 * Parses `node.data.inputSchema` from persisted JSON into a normalised field list.
 */
export function readInputSchemaFromNodeData({ value }: ReadInputSchemaFromNodeDataParams): NodeInputField[] {
  if (!Array.isArray(value)) return []
  const out: NodeInputField[] = []
  for (const item of value) {
    const field = coerceNodeInputField({ raw: item })
    if (field) out.push(field)
  }
  return out
}

export interface CoerceNodeInputFieldParams {
  raw: unknown
}

const NODE_INPUT_FIELD_TYPES: NodeInputFieldType[] = ["string", "number", "boolean", "text"]

/**
 * Merges persisted value slots: prefers legacy `defaultValue`, then canonical `value` (covers older rows that stored mapping-only under `value`).
 */
function mergePersistedFieldValue({ raw }: { raw: Record<string, unknown> }): string | undefined {
  const fromLegacyDefault = normaliseDefaultValueFromRaw({ raw: raw.defaultValue })
  const fromCanonical = normaliseDefaultValueFromRaw({ raw: raw.value })
  return fromLegacyDefault ?? fromCanonical
}

/**
 * Coerces a single unknown record into `NodeInputField`, or returns null if invalid.
 */
export function coerceNodeInputField({ raw }: CoerceNodeInputFieldParams): NodeInputField | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : ""
  const key = typeof o.key === "string" ? o.key.trim() : ""
  if (!id || !key) return null
  const label = typeof o.label === "string" ? o.label : key
  const typeRaw = o.type
  const type: NodeInputFieldType =
    typeof typeRaw === "string" && (NODE_INPUT_FIELD_TYPES as string[]).includes(typeRaw)
      ? (typeRaw as NodeInputFieldType)
      : "string"
  const required = Boolean(o.required)
  const description = typeof o.description === "string" ? o.description : undefined
  const value = mergePersistedFieldValue({ raw: o })
  return { id, key, label, type, required, description, value }
}

export interface NormaliseDefaultValueFromRawParams {
  raw: unknown
}

/**
 * Accepts string, number, or boolean JSON values and stores a normalised string for the editor model.
 */
export function normaliseDefaultValueFromRaw({ raw }: NormaliseDefaultValueFromRawParams): string | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === "boolean") return raw ? "true" : "false"
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw)
  if (typeof raw === "string") return raw.trim() === "" ? undefined : raw
  return undefined
}

export interface LabelToDefaultKeyParams {
  label: string
}

/**
 * Derives a snake_case key from a human label (for auto-fill when the user has not locked the key).
 */
export function labelToDefaultKey({ label }: LabelToDefaultKeyParams): string {
  const trimmed = label.trim().toLowerCase()
  if (!trimmed) return ""
  return trimmed
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
}

export interface SanitiseInputFieldKeyParams {
  key: string
}

/**
 * Normalises a user-entered key to a safe programmatic identifier.
 */
export function sanitiseInputFieldKey({ key }: SanitiseInputFieldKeyParams): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
}

export interface CreateEmptyNodeInputFieldParams {
  /** Overrides for the new row. */
  partial?: Partial<Pick<NodeInputField, "key" | "label" | "type" | "required" | "description" | "value">>
}

/**
 * Creates a new input field with a fresh id suitable for React keys.
 */
export function createEmptyNodeInputField({ partial }: CreateEmptyNodeInputFieldParams = {}): NodeInputField {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `field-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return {
    id,
    key: partial?.key ?? "new_field",
    label: partial?.label ?? "New field",
    type: partial?.type ?? "string",
    required: partial?.required ?? false,
    description: partial?.description,
    value: partial?.value,
  }
}

/**
 * Default outbound mapping for new **Generate text** AI steps: one `text` field bound to model output via `{{exe.text}}`.
 */
export function buildDefaultGenerateTextOutputSchemaFields(): NodeInputField[] {
  return [
    createEmptyNodeInputField({
      partial: {
        key: "text",
        label: "Text",
        type: "text",
        required: false,
        description: "Assistant text from this step’s AI execution.",
        value: "{{exe.text}}",
      },
    }),
  ]
}

/** Shape accepted in JSON mode (ids are refreshed when missing). */
export interface InputSchemaJsonItem {
  id?: string
  key: string
  label?: string
  type?: NodeInputFieldType
  required?: boolean
  description?: string
  value?: string | number | boolean
  /** @deprecated Read when migrating; canonical field is `value`. */
  defaultValue?: string | number | boolean
}

export interface SerialiseInputSchemaJsonParams {
  fields: NodeInputField[]
  /** When false, omits indentation. */
  pretty?: boolean
}

/**
 * Converts live editor fields into a minimal JSON document for the raw editor.
 */
export function serialiseInputSchemaJson({
  fields,
  pretty = true,
}: SerialiseInputSchemaJsonParams): string {
  const rows: InputSchemaJsonItem[] = fields.map((f) => {
    const row: InputSchemaJsonItem = {
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
    }
    if (f.id) row.id = f.id
    if (f.description?.trim()) row.description = f.description.trim()
    const dv = f.value?.trim()
    if (dv) {
      if (f.type === "boolean" && (dv === "true" || dv === "false")) {
        row.value = dv === "true"
      } else if (f.type === "number") {
        const n = Number(dv)
        row.value = Number.isFinite(n) ? n : dv
      } else {
        row.value = dv
      }
    }
    return row
  })
  return pretty ? `${JSON.stringify(rows, null, 2)}\n` : JSON.stringify(rows)
}

export interface ParseInputSchemaJsonParams {
  text: string
}

export type ParseInputSchemaJsonResult =
  | { ok: true; fields: NodeInputField[] }
  | { ok: false; error: string }

function newStableId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `field-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Parses JSON from the raw schema tab into normalised {@link NodeInputField} rows.
 */
export function parseInputSchemaJson({ text }: ParseInputSchemaJsonParams): ParseInputSchemaJsonResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ok: true, fields: [] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch {
    return { ok: false, error: "Invalid JSON: could not parse the document." }
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: "JSON must be an array of field objects." }
  }
  const keysSeen = new Set<string>()
  const out: NodeInputField[] = []
  for (let i = 0; i < parsed.length; i++) {
    const raw = parsed[i]
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: `Item ${i + 1} must be an object with a string "key".` }
    }
    const o = raw as Record<string, unknown>
    const keyRaw = typeof o.key === "string" ? o.key.trim() : ""
    if (!keyRaw) {
      return { ok: false, error: `Item ${i + 1} is missing a non-empty "key".` }
    }
    const normalisedKey = sanitiseInputFieldKey({ key: keyRaw })
    if (!normalisedKey) {
      return { ok: false, error: `Item ${i + 1}: "${keyRaw}" is not a usable field key.` }
    }
    if (keysSeen.has(normalisedKey)) {
      return { ok: false, error: `Duplicate key "${normalisedKey}" in the JSON array.` }
    }
    keysSeen.add(normalisedKey)

    const label =
      typeof o.label === "string" && o.label.trim() ? o.label.trim() : normalisedKey
    const typeRaw = o.type
    const type: NodeInputFieldType =
      typeof typeRaw === "string" && (NODE_INPUT_FIELD_TYPES as string[]).includes(typeRaw)
        ? (typeRaw as NodeInputFieldType)
        : "string"
    const required = Boolean(o.required)
    const description =
      typeof o.description === "string" && o.description.trim() ? o.description.trim() : undefined
    const value = mergePersistedFieldValue({ raw: o })
    const idFromJson = typeof o.id === "string" && o.id.trim() ? o.id.trim() : ""
    const id = idFromJson || newStableId()

    out.push({
      id,
      key: normalisedKey,
      label,
      type,
      required,
      description,
      value,
    })
  }
  return { ok: true, fields: out }
}
