/**
 * Placeholder for the optional guidance field on Classify steps (primary rules are hard-coded in the runner).
 */
export const AI_CLASSIFY_OPTIONAL_GUIDANCE_PLACEHOLDER =
  "Optional: tone, edge cases, or what to prioritise. The step already enforces one verbatim catalogue label, reasoning, and confidence."

function newCatalogueRowId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `classify-row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export interface ClassifyLabelRowPersisted {
  id: string
  /** Primary category identifier surfaced to the model. */
  label: string
  description: string
}

/**
 * Persisted catalogue row factory for workflow graph JSON (`node.data.classifyLabels`).
 */
export function createEmptyClassifyLabelPersistedRow({
  partial,
}: {
  partial?: Partial<Pick<ClassifyLabelRowPersisted, "label" | "description">>
} = {}): ClassifyLabelRowPersisted {
  return {
    id: newCatalogueRowId(),
    label: partial?.label ?? "",
    description: partial?.description ?? "",
  }
}

/**
 * New Classify nodes start with an empty catalogue so authors add only the categories they need.
 */
export function buildDefaultClassifyLabelRows(): ClassifyLabelRowPersisted[] {
  return []
}

export interface ReadClassifyLabelRowsFromNodeDataParams {
  value: unknown
}

/**
 * Reads `node.data.classifyLabels` as persisted rows for the inspector UI (preserves ids).
 */
export function readClassifyLabelRowsFromNodeData({
  value,
}: ReadClassifyLabelRowsFromNodeDataParams): ClassifyLabelRowPersisted[] {
  if (!Array.isArray(value)) return []
  const out: ClassifyLabelRowPersisted[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : newCatalogueRowId()
    const label = typeof o.label === "string" ? o.label : typeof o.value === "string" ? o.value : ""
    const trimmedLabel = typeof label === "string" ? label.trim() : ""
    const description = typeof o.description === "string" ? o.description.trim() : ""
    out.push({ id, label: trimmedLabel, description })
  }
  return out
}
