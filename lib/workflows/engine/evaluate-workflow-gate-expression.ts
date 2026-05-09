import type { Node } from "@xyflow/react"

import { buildResolutionContext } from "@/lib/workflows/engine/template"

/**
 * Discriminates routing planned after a decision or switch step evaluates its gate expressions.
 */
export type WorkflowGatePlan =
  | { kind: "none" }
  | { kind: "decision"; truthy: boolean }
  | { kind: "switch"; caseId: string | null }

/** Outcome of planning decision routing from the node's condition and inbound payload. */
export type PlanDecisionGateResult =
  | { ok: true; plan: Extract<WorkflowGatePlan, { kind: "decision" }> }
  | { ok: false; error: string }

/** Outcome of planning switch routing from ordered branch conditions. */
export type PlanSwitchGateResult =
  | { ok: true; plan: Extract<WorkflowGatePlan, { kind: "switch" }> }
  | { ok: false; error: string }

/**
 * Evaluates a JavaScript boolean expression with a restricted scope (`input`, `prev`, `global`, `trigger`, `constants`).
 * The result is coerced with `!!` so any truthy/falsey outcome maps to a branch.
 *
 * Bindings:
 *  - `input`      — predecessor step's emitted output (or the trigger payload on the entry node)
 *  - `prev`       — alias of `input`, retained for back-compat with persisted expressions
 *  - `global`     — accumulated workflow globals
 *  - `trigger`    — original workflow invoke payload (`{{trigger_inputs.*}}`)
 *  - `constants`  — workflow constants map (`{{const.*}}`)
 *
 * Empty or whitespace-only expressions are treated as falsy (false branch / no match).
 */
export function evaluateWorkflowGateExpression({
  expression,
  node,
  stepInput,
}: {
  expression: string
  node: Node
  stepInput: unknown
}): boolean {
  const trimmed = expression.trim()
  if (!trimmed) return false

  const role = node.type === "entry" ? "entry" : "standard"
  const context = buildResolutionContext({ stepInput, stepId: node.id, role })

  try {
    const fn = new Function(
      "input",
      "prev",
      "global",
      "trigger",
      "constants",
      `"use strict"; return !!( ${trimmed} );`,
    )
    return fn(
      context.input,
      context.prev,
      context.global,
      context.trigger_inputs,
      context["const"],
    ) as boolean
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Gate expression error: ${message}`)
  }
}

/**
 * Plans which decision handle (`true` / `false`) should be followed after successful step execution.
 */
export function planDecisionGate({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): PlanDecisionGateResult {
  const data = node.data as Record<string, unknown> | undefined
  const condition = typeof data?.condition === "string" ? data.condition : ""
  try {
    const truthy = evaluateWorkflowGateExpression({ expression: condition, node, stepInput })
    return { ok: true, plan: { kind: "decision", truthy } }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/**
 * Plans which switch exit (a case id or default) should be followed — first truthy condition wins.
 */
export function planSwitchGate({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): PlanSwitchGateResult {
  const data = node.data as Record<string, unknown> | undefined
  const rawBranches = data?.branches
  if (!Array.isArray(rawBranches)) {
    return { ok: true, plan: { kind: "switch", caseId: null } }
  }

  for (const raw of rawBranches) {
    const row = raw as Record<string, unknown> | undefined
    const id = typeof row?.id === "string" ? row.id.trim() : ""
    const condition = typeof row?.condition === "string" ? row.condition : ""
    /** Skip malformed rows so a single bad persisted entry does not halt the whole workflow. */
    if (!id) continue
    try {
      const truthy = evaluateWorkflowGateExpression({ expression: condition, node, stepInput })
      if (truthy) {
        return { ok: true, plan: { kind: "switch", caseId: id } }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `Switch case “${id}”: ${message}` }
    }
  }

  return { ok: true, plan: { kind: "switch", caseId: null } }
}
