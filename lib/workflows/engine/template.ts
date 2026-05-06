/**
 * `{{...}}` template resolution for workflow step output and prompt fields.
 * Used by server-side step executors and the runner execution envelope.
 */

import { readRunnerGatewayExecutionContextFromStepInput } from "@/lib/ai-gateway/runner-gateway-tracking"
import type { NodeInputField, NodeInputFieldType } from "@/lib/workflows/engine/input-schema"
import { readGlobalsFromExecutionStepInput } from "@/lib/workflows/engine/runner"

/** Flat dot-path accessor: `get(obj, "a.b.c")` → `obj?.a?.b?.c`. */
export function getByPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined
  const parts = path.split(".")
  let cur: unknown = obj
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** Pads an integer used in clocks to two digits (`0`–`99`). */
function padTwoDigits(n: number): string {
  return String(n).padStart(2, "0")
}

/**
 * Builds the UTC-facing `now` map used while resolving workflow tag expressions.
 *
 * Month names follow the `en-AU` locale. `day` is the day-of-month in UTC (`1`–`31`).
 * `time_24` uses `HH:mm:ss`; `time_12` uses `h:mm:ss am/pm`.
 *
 * Weekday numbering follows ISO 8601 in UTC (`1` = Monday through `7` = Sunday).
 */
export function buildUtcNowPromptFields({ now }: { now: Date }) {
  const year = now.getUTCFullYear()
  const monthIndex = now.getUTCMonth()
  const day = now.getUTCDate()
  const monthNumber = monthIndex + 1

  const monthFull = new Intl.DateTimeFormat("en-AU", {
    month: "long",
    timeZone: "UTC",
  }).format(now)

  const monthShort = new Intl.DateTimeFormat("en-AU", {
    month: "short",
    timeZone: "UTC",
  }).format(now)

  const hour24 = now.getUTCHours()
  const minutes = now.getUTCMinutes()
  const seconds = now.getUTCSeconds()

  const time24 = `${padTwoDigits(hour24)}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`

  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  const dayHalf = hour24 < 12 ? "am" : "pm"
  const time12 = `${hour12}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)} ${dayHalf}`

  const utcMidnightOrdinal = Date.UTC(year, monthIndex, day)
  const utcJan1SameYear = Date.UTC(year, 0, 1)
  const dayOfYear =
    Math.floor((utcMidnightOrdinal - utcJan1SameYear) / 86_400_000) + 1

  const weekdayJs = now.getUTCDay()
  /** ISO 8601 weekday in UTC (`1` = Monday … `7` = Sunday). */
  const weekdayNumber = weekdayJs === 0 ? 7 : weekdayJs

  const weekdayFull = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    timeZone: "UTC",
  }).format(now)

  const weekdayShort = new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    timeZone: "UTC",
  }).format(now)

  const slugTimestamp = `${year}-${padTwoDigits(monthNumber)}-${padTwoDigits(day)}_${padTwoDigits(hour24)}-${padTwoDigits(minutes)}-${padTwoDigits(seconds)}`

  return {
    iso: now.toISOString(),
    unix_ms: now.getTime(),
    date: now.toISOString().slice(0, 10),
    year,
    day,
    month: monthNumber,
    month_full: monthFull,
    month_short: monthShort,
    time_24: time24,
    time_12: time12,
    day_of_year: dayOfYear,
    weekday_number: weekdayNumber,
    weekday_full: weekdayFull,
    weekday_short: weekdayShort,
    slug_timestamp: slugTimestamp,
  }
}

/** Stringifies a resolved value to something safe to interpolate into a prompt. */
export function stringify(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export interface BuildResolutionContextParams {
  /** Runner execution envelope (trigger payload, predecessor, globals, gateway context). */
  stepInput: unknown
  /**
   * React Flow node id for the step currently executing (`{{step.id}}`).
   * Omit or pass an empty string when resolving without graph context (for example previews).
   */
  stepId?: string
}

/**
 * Builds the template resolution context from the step input envelope.
 *
 * Exposes:
 *  - `trigger_inputs.*`  — original manual trigger fields
 *  - `prev.*`            — predecessor step's evaluated output
 *  - `input.*`           — alias for trigger_inputs (entry-node convention)
 *  - `global.*`          — accumulated workflow globals from prior steps (`{{global.key}}`)
 *  - `run.*`, `workflow.*`, `step.*`, `user.*` — ids and signed-in author fields from the gateway envelope when present
 *  - `now.*`             — current UTC helpers (see {@link buildUtcNowPromptFields})
 */
export function buildResolutionContext({
  stepInput,
  stepId = "",
}: BuildResolutionContextParams): Record<string, unknown> {
  const envelope =
    stepInput && typeof stepInput === "object" ? (stepInput as Record<string, unknown>) : {}

  const triggerInputs =
    envelope.trigger_inputs && typeof envelope.trigger_inputs === "object"
      ? (envelope.trigger_inputs as Record<string, unknown>)
      : {}

  const predecessorOutput = (() => {
    const pred = envelope.predecessor
    if (!pred || typeof pred !== "object") return {}
    const p = pred as Record<string, unknown>
    if (p.step_output_emitted && typeof p.step_output_emitted === "object") {
      return p.step_output_emitted as Record<string, unknown>
    }
    return {}
  })()

  const globalMap = readGlobalsFromExecutionStepInput({ stepInput })

  const nowUtc = buildUtcNowPromptFields({ now: new Date() })

  const gateway = readRunnerGatewayExecutionContextFromStepInput({ stepInput })
  const run = { id: gateway?.workflowRunId ?? "" }
  const workflow = { id: gateway?.workflowId ?? "", name: gateway?.workflowName ?? "" }
  const step = { id: stepId }
  const user = {
    name: gateway?.userDisplayName ?? "",
    email: gateway?.userEmail ?? "",
  }

  return {
    trigger_inputs: triggerInputs,
    // `input.*` is the entry-node alias for trigger_inputs
    input: triggerInputs,
    // `prev.*` resolves against the predecessor's evaluated output
    prev: predecessorOutput,
    global: globalMap,
    run,
    workflow,
    step,
    user,
    now: nowUtc,
  }
}

/**
 * Resolves all `{{...}}` tag expressions in a template string.
 * Unresolved or empty expressions are replaced with an empty string.
 */
export function resolveTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, expr: string) => {
    const path = expr.trim()
    const value = getByPath(context, path)
    return stringify(value)
  })
}

/**
 * Coerces a resolved template string to a runtime value matching the declared field type.
 *
 * Centralises the same logic used by the gate-expression evaluator and the document executor
 * so that all step outputs and globals carry properly-typed primitives rather than raw strings.
 * Falls back to the original string when coercion is not possible (e.g. non-finite number input).
 */
export function coerceFieldValue({
  text,
  type,
}: {
  text: string
  type: NodeInputFieldType
}): unknown {
  const trimmed = text.trim()
  switch (type) {
    case "number": {
      const n = Number(trimmed)
      return Number.isFinite(n) ? n : trimmed
    }
    case "boolean": {
      if (trimmed === "true") return true
      if (trimmed === "false") return false
      return trimmed
    }
    case "json": {
      try {
        return JSON.parse(trimmed) as unknown
      } catch {
        return trimmed
      }
    }
    default:
      // "string" | "text" — return the raw resolved string unchanged
      return text
  }
}

/**
 * Resolves output schema fields against the given context and coerces each value to its
 * declared type. Replaces the ad-hoc `resolveTemplate` loop in step executors so that
 * numeric, boolean, and JSON outputs are stored with the correct runtime type rather than
 * always as strings — allowing downstream condition checks like `prev.score > 90` to work
 * correctly without relying solely on JavaScript's implicit type coercion.
 */
export function resolveOutputSchemaFields({
  outputSchema,
  context,
}: {
  outputSchema: NodeInputField[]
  context: Record<string, unknown>
}): Record<string, unknown> {
  const resolvedOutputs: Record<string, unknown> = {}
  for (const field of outputSchema) {
    if (!field.value) continue
    const text = resolveTemplate(field.value, context)
    resolvedOutputs[field.key] = coerceFieldValue({ text, type: field.type })
  }
  return resolvedOutputs
}

/**
 * Resolves optional globals schema rows into a map for `stepOutput.globals`.
 * Values are coerced to their declared type so `global.count` is a number when the
 * field is typed as `number`, enabling reliable numeric comparisons in gate conditions.
 */
export function resolveGlobalsSchema({
  globalsSchema,
  context,
}: {
  globalsSchema: NodeInputField[]
  context: Record<string, unknown>
}): Record<string, unknown> {
  const globals: Record<string, unknown> = {}
  for (const field of globalsSchema) {
    if (!field.value) continue
    const text = resolveTemplate(field.value, context)
    globals[field.key] = coerceFieldValue({ text, type: field.type })
  }
  return globals
}

/**
 * Parses a resolved expression as a finite number or throws an actionable executor error.
 */
export function parseFiniteNumberFromResolved({
  text,
  fieldLabel,
}: {
  text: string
  fieldLabel: string
}): number {
  const t = text.trim()
  if (t === "") {
    throw new Error(`${fieldLabel} resolved to an empty value.`)
  }
  const n = Number(t)
  if (!Number.isFinite(n)) {
    throw new Error(`${fieldLabel} must be a finite number (got "${String(t)}").`)
  }
  return n
}

/**
 * Draws uniformly on [min, max] inclusively — integer-valued when both bounds are integers.
 */
export function drawUniformInclusiveBetween({ min, max }: { min: number; max: number }): number {
  let lo = min
  let hi = max
  if (hi < lo) {
    const swap = lo
    lo = hi
    hi = swap
  }
  const discrete = Number.isInteger(lo) && Number.isInteger(hi)
  if (discrete) {
    return Math.floor(Math.random() * (hi - lo + 1)) + lo
  }
  return Math.random() * (hi - lo) + lo
}

/**
 * Resolves declared `inputSchema` cells against the inbound envelope (`{{prev.*}}`, `{{input.*}}`, etc.).
 */
export function resolveDeclaredInputsMap({
  inputSchema,
  context,
}: {
  inputSchema: NodeInputField[]
  context: Record<string, unknown>
}): Record<string, string> {
  const resolvedInputs: Record<string, string> = {}
  for (const field of inputSchema) {
    if (!field.value) continue
    resolvedInputs[field.key] = resolveTemplate(field.value, context)
  }
  return resolvedInputs
}
