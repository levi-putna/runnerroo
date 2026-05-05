/**
 * Typed input field definitions for workflow steps (similar to n8n node parameters
 * or Zapier inputFields). Used to declare what each step expects at runtime and
 * how to reference values in prompts or code via `{{input.key}}`.
 */

/** Supported primitive types for a declared input field (`json`: parsed JSON arrays/objects — e.g. docxtemplater loops). */
export type NodeInputFieldType = "string" | "number" | "boolean" | "text" | "json"

/** One field in a step's input schema. */
export interface NodeInputField {
  /** Stable id for list keys in the UI. */
  id: string
  /** Programmatic key (letters, digits, `-`, `_` only); referenced as `{{input.key}}`. */
  key: string
  /** Human-readable label in the editor. */
  label: string
  type: NodeInputFieldType
  required: boolean
  description?: string
  /**
   * Literal or tag expression (`{{now.iso}}`, `{{input.other_key}}`, `{{prev.text}}`, booleans as `true`/`false` strings).
   * For `type: "json"`, use a JSON array/object literal or a tag such as `{{prev.items}}` that resolves to JSON for docxtemplater loops.
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

const NODE_INPUT_FIELD_TYPES: NodeInputFieldType[] = ["string", "number", "boolean", "text", "json"]

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
 * Keys are normalised with {@link sanitiseInputFieldKey} so persisted graphs stay identifier-safe.
 */
export function coerceNodeInputField({ raw }: CoerceNodeInputFieldParams): NodeInputField | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : ""
  const keyRaw = typeof o.key === "string" ? o.key.trim() : ""
  const key = keyRaw ? sanitiseInputFieldKey({ key: keyRaw }) : ""
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
 * Accepts string, number, boolean, or structured JSON-able values for the canonical `value` slot.
 */
export function normaliseDefaultValueFromRaw({ raw }: NormaliseDefaultValueFromRawParams): string | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === "boolean") return raw ? "true" : "false"
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw)
  if (typeof raw === "string") return raw.trim() === "" ? undefined : raw
  if (typeof raw === "object" && raw !== null) {
    try {
      return JSON.stringify(raw)
    } catch {
      return undefined
    }
  }
  return undefined
}

export interface LabelToDefaultKeyParams {
  label: string
}

/**
 * Derives a key from a human label (for auto-fill when the user has not locked the key).
 * Only letters, digits, hyphens, and underscores are kept; other runs become a single underscore.
 */
export function labelToDefaultKey({ label }: LabelToDefaultKeyParams): string {
  const trimmed = label.trim().toLowerCase()
  if (!trimmed) return ""
  return trimmed
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
}

export interface SanitiseInputFieldKeyParams {
  key: string
}

/**
 * Normalises a user-entered key: lowercase ASCII; whitespace becomes underscore; only letters, digits,
 * hyphen, and underscore remain; leading and trailing separators are stripped.
 */
export function sanitiseInputFieldKey({ key }: SanitiseInputFieldKeyParams): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^[-_]+|[-_]+$/g, "")
}

export interface ClipWorkflowFieldKeyInputParams {
  value: string
}

/**
 * Restricts in-progress key entry: lowercases, turns whitespace into underscores, then allows only
 * letters, digits, hyphens, and underscores (end trimming is applied on save via {@link sanitiseInputFieldKey}).
 */
export function clipWorkflowFieldKeyInput({ value }: ClipWorkflowFieldKeyInputParams): string {
  return value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "")
}

/** Allowed pattern for schema keys in raw JSON (before lowercasing). */
const WORKFLOW_FIELD_KEY_JSON_PATTERN = /^[a-zA-Z0-9_-]+$/

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

/**
 * Default outbound mappings for **Classify** AI steps (`exe.classifier_*` structured output fields).
 */
export function buildDefaultClassifyOutputSchemaFields(): NodeInputField[] {
  return [
    createEmptyNodeInputField({
      partial: {
        key: "label",
        label: "Label",
        type: "string",
        required: false,
        description: "Chosen category label emitted by the classifier (matches one catalogue identifier exactly).",
        value: "{{exe.classifier_label}}",
      },
    }),
    createEmptyNodeInputField({
      partial: {
        key: "confidence",
        label: "Confidence",
        type: "number",
        required: false,
        description:
          "Model-reported subjective certainty between 0 and 1 inclusive (interpret as a calibrated self-assessment, not a calibrated probability unless you validated it downstream).",
        value: "{{exe.classifier_confidence}}",
      },
    }),
    createEmptyNodeInputField({
      partial: {
        key: "reasoning",
        label: "Reasoning",
        type: "text",
        required: false,
        description: "Brief evidence-based justification referencing concrete phrases or fields from the input payload.",
        value: "{{exe.classifier_reasoning}}",
      },
    }),
  ]
}

/**
 * Default declared inputs for **Classify** AI steps — map into `{{input.*}}` for the classifier payload.
 */
export function buildDefaultClassifyInputSchemaFields(): NodeInputField[] {
  return [
    createEmptyNodeInputField({
      partial: {
        key: "content",
        label: "Content",
        type: "text",
        required: false,
        description:
          "Primary payload to classify. Map from literals, {{prev.*}} references, workflow {{global.*}} helpers, etc.",
        value: "",
      },
    }),
  ]
}

/**
 * Default declared inputs for a **Random number** step: inclusive bounds resolved from literals or tags.
 */
export function buildDefaultRandomNumberInputSchemaFields(): NodeInputField[] {
  return [
    createEmptyNodeInputField({
      partial: {
        key: "min",
        label: "Min",
        type: "number",
        required: true,
        description: "Lower bound (inclusive). May be a literal or a tagged expression.",
        value: "0",
      },
    }),
    createEmptyNodeInputField({
      partial: {
        key: "max",
        label: "Max",
        type: "number",
        required: true,
        description: "Upper bound (inclusive). May be a literal or a tagged expression.",
        value: "100",
      },
    }),
  ]
}

/**
 * Default outbound mapping for **Random number** steps: one field bound to the generated value via `{{exe.number}}`.
 */
export function buildDefaultRandomNumberOutputSchemaFields(): NodeInputField[] {
  return [
    createEmptyNodeInputField({
      partial: {
        key: "random_number",
        label: "Random number",
        type: "number",
        required: false,
        description: "Uniform draw between min and max when both resolve to integers; otherwise a fractional value in the continuous range.",
        value: "{{exe.number}}",
      },
    }),
  ]
}

/**
 * Default declared inputs for an **Iteration** step: the value advanced by the configured increment.
 */
export function buildDefaultIterationInputSchemaFields(): NodeInputField[] {
  return [
    createEmptyNodeInputField({
      partial: {
        key: "starting_number",
        label: "Starting number",
        type: "number",
        required: true,
        description: "Base value before adding the increment. May be a literal or a tagged expression.",
        value: "",
      },
    }),
  ]
}

/**
 * Default outbound mapping for **Iteration** steps: exposed result after `starting_number + increment`.
 */
export function buildDefaultIterationOutputSchemaFields(): NodeInputField[] {
  return [
    createEmptyNodeInputField({
      partial: {
        key: "number",
        label: "Number",
        type: "number",
        required: false,
        description: "Result of starting number plus the resolved increment from the Execution tab.",
        value: "{{exe.number}}",
      },
    }),
  ]
}

/**
 * Default outbound mapping for **Generate document** steps: filename and downloadable URL from execution.
 */
export function buildDefaultGenerateDocumentOutputSchemaFields(): NodeInputField[] {
  return [
    createEmptyNodeInputField({
      partial: {
        key: "file_name",
        label: "File name",
        type: "string",
        required: false,
        description:
          "Filename of the generated .docx after resolving the execution file name (literal or tags such as `{{prev.*}}`, `{{input.*}}`, `{{global.*}}`).",
        value: "{{exe.outputFileName}}",
      },
    }),
    createEmptyNodeInputField({
      partial: {
        key: "document_url",
        label: "Document URL",
        type: "string",
        required: false,
        description: "Fully qualified signed URL to download the generated document.",
        value: "{{exe.documentUrl}}",
      },
    }),
  ]
}

/** Inline JSON payloads allowed when editing schema arrays/objects in JSON mode. */
export type InputSchemaJsonInlineValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[]

/** Shape accepted in JSON mode (ids are refreshed when missing). */
export interface InputSchemaJsonItem {
  id?: string
  key: string
  label?: string
  type?: NodeInputFieldType
  required?: boolean
  description?: string
  /** Plain string, number/boolean primitives, or inline JSON/array objects for `json`-typed rows. */
  value?: InputSchemaJsonInlineValue
  /** @deprecated Read when migrating; canonical field is `value`. */
  defaultValue?: InputSchemaJsonInlineValue
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
      } else if (f.type === "json") {
        try {
          row.value = JSON.parse(dv) as InputSchemaJsonInlineValue
        } catch {
          row.value = dv
        }
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
    if (!WORKFLOW_FIELD_KEY_JSON_PATTERN.test(keyRaw)) {
      return {
        ok: false,
        error: `Item ${i + 1}: keys may only contain letters, digits, hyphens (-), and underscores (_).`,
      }
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

export interface MergeIncomingInputFieldsAppendParams {
  /** Current editor rows preserved in order. */
  existing: NodeInputField[]
  /** Newly generated rows; duplicates by key are skipped. */
  incoming: NodeInputField[]
}

/**
 * Appends generated fields after existing ones while skipping keys that already exist — keeps authored rows authoritative.
 *
 * @param params - Existing editor fields plus an incoming batch (usually from AI import).
 */
export function mergeIncomingInputFieldsAppend({
  existing,
  incoming,
}: MergeIncomingInputFieldsAppendParams): { merged: NodeInputField[]; skippedDuplicateKeys: string[] } {
  const keysSeen = new Set(existing.map((field) => field.key))
  const skippedDuplicateKeys: string[] = []
  const additions: NodeInputField[] = []
  for (const row of incoming) {
    if (keysSeen.has(row.key)) {
      skippedDuplicateKeys.push(row.key)
      continue
    }
    keysSeen.add(row.key)
    additions.push(row)
  }
  return { merged: [...existing, ...additions], skippedDuplicateKeys }
}
