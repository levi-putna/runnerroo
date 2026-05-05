/**
 * Normalises category labels for the Classify AI step (static rows or expression JSON).
 */

export interface ClassifyCatalogueEntry {
  /** Exact label string the model must return (case-sensitive unless the author instructions say otherwise). */
  label: string
  /** Guidance for what belongs in this category. */
  description: string
}

export interface ReadPersistedClassifyLabelsFromNodeParams {
  value: unknown
}

/**
 * Reads `node.data.classifyLabels` from persisted graph JSON into a normalised catalogue.
 */
export function readPersistedClassifyLabelsFromNode({
  value,
}: ReadPersistedClassifyLabelsFromNodeParams): ClassifyCatalogueEntry[] {
  if (!Array.isArray(value)) return []
  const out: ClassifyCatalogueEntry[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const fromValue = typeof o.value === "string" ? o.value.trim() : ""
    const fromLabel = typeof o.label === "string" ? o.label.trim() : ""
    const label = fromValue || fromLabel
    if (!label) continue
    const description = typeof o.description === "string" ? o.description.trim() : ""
    out.push({ label, description })
  }
  return uniqueLabelsOrThrow({ entries: out })
}

export interface ParseClassifyLabelCatalogueFromResolvedTextParams {
  /** Template output after `resolveTemplate` — must be JSON (optionally fenced). */
  text: string
}

/**
 * Parses JSON from a resolved expression into catalogue entries.
 *
 * Accepts:
 * - an array of `{ label, description? }` or `{ value, description? }`
 * - a record of label → description strings
 */
export function parseClassifyLabelCatalogueFromResolvedText({
  text,
}: ParseClassifyLabelCatalogueFromResolvedTextParams): ClassifyCatalogueEntry[] {
  const stripped = stripOptionalJsonFence({ text: text.trim() })
  if (!stripped) {
    throw new Error("Classify labels expression resolved to an empty string — provide JSON.")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped) as unknown
  } catch {
    throw new Error("Classify labels expression must resolve to valid JSON (array or object).")
  }
  return parseClassifyLabelCatalogueFromUnknown({ value: parsed })
}

export interface ParseClassifyLabelCatalogueFromUnknownParams {
  value: unknown
}

/**
 * Coerces an already-parsed JSON value into catalogue entries.
 */
export function parseClassifyLabelCatalogueFromUnknown({
  value,
}: ParseClassifyLabelCatalogueFromUnknownParams): ClassifyCatalogueEntry[] {
  if (Array.isArray(value)) {
    const out: ClassifyCatalogueEntry[] = []
    for (const item of value) {
      if (!item || typeof item !== "object") continue
      const o = item as Record<string, unknown>
      const fromValue = typeof o.value === "string" ? o.value.trim() : ""
      const fromLabel = typeof o.label === "string" ? o.label.trim() : ""
      const label = fromValue || fromLabel
      if (!label) continue
      const description = typeof o.description === "string" ? o.description.trim() : ""
      out.push({ label, description })
    }
    return uniqueLabelsOrThrow({ entries: out })
  }

  if (value && typeof value === "object") {
    const out: ClassifyCatalogueEntry[] = []
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const label = k.trim()
      if (!label) continue
      const description = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim()
      out.push({ label, description })
    }
    return uniqueLabelsOrThrow({ entries: out })
  }

  throw new Error("Classify labels JSON must be an array of label objects or a label→description map.")
}

export interface SerialiseClassifyCatalogueForPromptParams {
  entries: ClassifyCatalogueEntry[]
}

/**
 * Pretty-prints the catalogue for injection into the model prompt.
 */
export function serialiseClassifyCatalogueForPrompt({
  entries,
}: SerialiseClassifyCatalogueForPromptParams): string {
  return JSON.stringify(entries, null, 2)
}

export interface StripOptionalJsonFenceParams {
  text: string
}

function stripOptionalJsonFence({ text }: StripOptionalJsonFenceParams): string {
  const t = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t)
  if (fence?.[1]) return fence[1].trim()
  return t
}

export interface UniqueLabelsOrThrowParams {
  entries: ClassifyCatalogueEntry[]
}

function uniqueLabelsOrThrow({ entries }: UniqueLabelsOrThrowParams): ClassifyCatalogueEntry[] {
  const seen = new Set<string>()
  for (const e of entries) {
    if (seen.has(e.label)) {
      throw new Error(`Duplicate classify label "${e.label}" — each label must be unique.`)
    }
    seen.add(e.label)
  }
  return entries
}
