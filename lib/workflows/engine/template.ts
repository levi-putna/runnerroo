/**
 * `{{...}}` template resolution for workflow step output and prompt fields.
 * Used by server-side step executors and the runner execution envelope.
 */

import type { NodeInputField } from "@/lib/workflows/engine/input-schema"
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

/**
 * Builds the template resolution context from the step input envelope.
 *
 * Exposes:
 *  - `trigger_inputs.*`  — original manual trigger fields
 *  - `prev.*`            — predecessor step's evaluated output
 *  - `input.*`           — alias for trigger_inputs (entry-node convention)
 *  - `global.*`          — accumulated workflow globals from prior steps (`{{global.key}}`)
 *  - `now.*`             — current UTC time helpers
 */
export function buildResolutionContext(stepInput: unknown): Record<string, unknown> {
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

  const now = new Date()

  return {
    trigger_inputs: triggerInputs,
    // `input.*` is the entry-node alias for trigger_inputs
    input: triggerInputs,
    // `prev.*` resolves against the predecessor's evaluated output
    prev: predecessorOutput,
    global: globalMap,
    now: {
      iso: now.toISOString(),
      unix_ms: now.getTime(),
      date: now.toISOString().slice(0, 10),
    },
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
 * Resolves optional globals schema rows into a map for `stepOutput.globals`.
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
    globals[field.key] = resolveTemplate(field.value, context)
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
