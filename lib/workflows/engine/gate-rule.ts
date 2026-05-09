/**
 * Structured visual gate rules — the data model behind the Gate tab condition builder.
 *
 * Rules are stored on the node as `data.gateGroups` (Decision) or `branch.gateGroups` (Switch).
 * On every change the UI also compiles to `data.condition` / `branch.condition` so the runner
 * can evaluate them without knowing about the visual structure.
 */

// ─── Operator catalogue ─────────────────────────────────────────────────────

export type GateOperator =
  | "equals"
  | "not_equals"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "is_true"
  | "is_false"

export interface GateOperatorMeta {
  label: string
  /** Short symbol shown in the collapsed row summary. */
  symbol: string
  /** When false, no value field is shown (unary operator). */
  needsValue: boolean
}

export const GATE_OPERATOR_META: Record<GateOperator, GateOperatorMeta> = {
  equals: { label: "equals", symbol: "=", needsValue: true },
  not_equals: { label: "does not equal", symbol: "≠", needsValue: true },
  gt: { label: "is greater than", symbol: ">", needsValue: true },
  gte: { label: "is greater than or equal to", symbol: "≥", needsValue: true },
  lt: { label: "is less than", symbol: "<", needsValue: true },
  lte: { label: "is less than or equal to", symbol: "≤", needsValue: true },
  contains: { label: "contains", symbol: "⊃", needsValue: true },
  not_contains: { label: "does not contain", symbol: "⊅", needsValue: true },
  starts_with: { label: "starts with", symbol: "^=", needsValue: true },
  ends_with: { label: "ends with", symbol: "=$", needsValue: true },
  is_empty: { label: "is empty", symbol: "∅", needsValue: false },
  is_not_empty: { label: "is not empty", symbol: "≠∅", needsValue: false },
  is_true: { label: "is true", symbol: "✓", needsValue: false },
  is_false: { label: "is false / empty", symbol: "✗", needsValue: false },
}

export const GATE_OPERATORS_ORDERED: GateOperator[] = [
  "equals",
  "not_equals",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
  "is_true",
  "is_false",
]

// ─── Rule / group types ──────────────────────────────────────────────────────

/** One condition row: a field path, an operator, and (optionally) a value expression. */
export interface GateRule {
  /** Stable id for React list keys. */
  id: string
  /** Tag path, e.g. `input.status`, `global.count`, `const.base_url`, `trigger_inputs.email`. */
  field: string
  operator: GateOperator
  /**
   * Literal text or `{{tag.id}}` expression for the right-hand side.
   * Empty string when `GATE_OPERATOR_META[operator].needsValue === false`.
   */
  value: string
}

/** One group of rules with a shared AND / OR joining logic. */
export interface GateGroup {
  /** "and" → ALL rules must match; "or" → ANY rule is sufficient. */
  logic: "and" | "or"
  rules: GateRule[]
}

// ─── Factory helpers ─────────────────────────────────────────────────────────

/**
 * Returns an id suitable for React list keys.
 * Uses Web Crypto when present; otherwise falls back for hosts where `crypto.randomUUID` is unavailable (non-HTTPS, older browsers).
 */
function newGateRuleId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `gate-rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Creates a blank rule row with a stable random id. */
export function createEmptyGateRule(): GateRule {
  return { id: newGateRuleId(), field: "", operator: "equals", value: "" }
}

/** Creates a new gate group with one blank rule. */
export function createEmptyGateGroup(): GateGroup {
  return { logic: "and", rules: [createEmptyGateRule()] }
}

// ─── Compiler: GateGroup → JavaScript expression ────────────────────────────

/**
 * Converts a FunctionInput value (literals + `{{tag.id}}`) to a JavaScript expression fragment.
 *
 * Mapping:
 * - `{{tag.id}}` → `tag.id`  (bare JS identifier path)
 * - numeric literals → numeric literal (unquoted)
 * - `true` / `false` → boolean literal
 * - anything else → double-quoted string literal
 * - mixed template (`hello {{name}}`) → JS template literal
 */
export function compileValueToJs({ value }: { value: string }): string {
  const trimmed = value.trim()

  // Pure tag reference: {{tag.id}} → tag.id
  const pureTag = /^\{\{([^}]+)\}\}$/.exec(trimmed)
  if (pureTag) return pureTag[1] ?? '""'

  // Numeric literal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed

  // Boolean literals
  if (trimmed === "true") return "true"
  if (trimmed === "false") return "false"

  // Mixed template (text + one or more tags) — compile to JS template literal
  if (trimmed.includes("{{")) {
    const converted = trimmed
      .replace(/\{\{([^}]+)\}\}/g, (_m, id: string) => `\${${id}}`)
      .replace(/`/g, "\\`")
    return `\`${converted}\``
  }

  // Plain string — escape double quotes and wrap
  const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return `"${escaped}"`
}

/**
 * Compiles a single rule to a JavaScript boolean sub-expression.
 * Returns `null` when the rule is incomplete (missing field or invalid).
 */
export function compileGateRuleToJs({ rule }: { rule: GateRule }): string | null {
  const field = rule.field.trim()
  if (!field) return null

  const meta = GATE_OPERATOR_META[rule.operator]
  if (!meta) return null

  const lhs = field // direct JS path, e.g. `input.status`

  switch (rule.operator) {
    case "equals":
      return `String(${lhs}) === String(${compileValueToJs({ value: rule.value })})`
    case "not_equals":
      return `String(${lhs}) !== String(${compileValueToJs({ value: rule.value })})`
    case "gt":
      return `Number(${lhs}) > Number(${compileValueToJs({ value: rule.value })})`
    case "gte":
      return `Number(${lhs}) >= Number(${compileValueToJs({ value: rule.value })})`
    case "lt":
      return `Number(${lhs}) < Number(${compileValueToJs({ value: rule.value })})`
    case "lte":
      return `Number(${lhs}) <= Number(${compileValueToJs({ value: rule.value })})`
    case "contains":
      return `String(${lhs}).includes(String(${compileValueToJs({ value: rule.value })}))`
    case "not_contains":
      return `!String(${lhs}).includes(String(${compileValueToJs({ value: rule.value })}))`
    case "starts_with":
      return `String(${lhs}).startsWith(String(${compileValueToJs({ value: rule.value })}))`
    case "ends_with":
      return `String(${lhs}).endsWith(String(${compileValueToJs({ value: rule.value })}))`
    case "is_empty":
      return `(${lhs} == null || String(${lhs}) === "")`
    case "is_not_empty":
      return `(${lhs} != null && String(${lhs}) !== "")`
    case "is_true":
      return `!!(${lhs})`
    case "is_false":
      return `!(${lhs})`
    default:
      return null
  }
}

/**
 * Compiles a full gate group (AND/OR of rules) to a JavaScript boolean expression.
 * Returns `""` when no valid rules are present (caller should treat as always-false).
 */
export function compileGateGroupToExpression({ group }: { group: GateGroup }): string {
  const parts: string[] = []
  for (const rule of group.rules) {
    const compiled = compileGateRuleToJs({ rule })
    if (compiled) parts.push(compiled)
  }
  if (parts.length === 0) return ""
  const joiner = group.logic === "and" ? " && " : " || "
  return parts.length === 1 ? (parts[0] ?? "") : `(${parts.join(joiner)})`
}

// ─── Serialisation helpers ───────────────────────────────────────────────────

/** Parses `data.gateGroups` from node data into a typed `GateGroup`, returning null on failure. */
export function readGateGroupFromNodeData({ value }: { value: unknown }): GateGroup | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const logic = raw.logic === "or" ? "or" : "and"
  if (!Array.isArray(raw.rules)) return null
  const rules: GateRule[] = []
  for (const r of raw.rules as unknown[]) {
    if (!r || typeof r !== "object") continue
    const row = r as Record<string, unknown>
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : newGateRuleId()
    const field = typeof row.field === "string" ? row.field : ""
    const operator = (GATE_OPERATORS_ORDERED as string[]).includes(String(row.operator))
      ? (row.operator as GateOperator)
      : "equals"
    const ruleValue = typeof row.value === "string" ? row.value : ""
    rules.push({ id, field, operator, value: ruleValue })
  }
  if (rules.length === 0) return null
  return { logic, rules }
}

/** Parses `branch.gateGroups` for a switch case — same structure, separate helper for clarity. */
export function readSwitchBranchGateGroup({
  branchRaw,
}: {
  branchRaw: unknown
}): GateGroup | null {
  if (!branchRaw || typeof branchRaw !== "object") return null
  const b = branchRaw as Record<string, unknown>
  return readGateGroupFromNodeData({ value: b.gateGroup ?? null })
}
