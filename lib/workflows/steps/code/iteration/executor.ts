/**
 * Iteration step — starting number plus configurable increment.
 *
 * The starting number is supplied by an `iterationStartingNumberExpression` template (defaults
 * to `{{input.starting_number}}` so the step automatically reads the upstream payload). The
 * increment defaults to `1` and is resolved as a tagged template against the same context.
 */

import type { Node } from "@xyflow/react"

import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  parseFiniteNumberFromResolved,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
  resolveTemplate,
} from "@/lib/workflows/engine/template"

export const DEFAULT_ITERATION_STARTING_NUMBER_EXPRESSION = "{{input.starting_number}}"
export const DEFAULT_ITERATION_INCREMENT_EXPRESSION = "1"

export function executeIterationStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Record<string, unknown> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  const context = buildResolutionContext({ stepInput, stepId: node.id })

  const startingNumberTemplateRaw =
    typeof data?.iterationStartingNumberExpression === "string"
      ? data.iterationStartingNumberExpression
      : DEFAULT_ITERATION_STARTING_NUMBER_EXPRESSION
  const startingNumberTemplate =
    startingNumberTemplateRaw.trim() === ""
      ? DEFAULT_ITERATION_STARTING_NUMBER_EXPRESSION
      : startingNumberTemplateRaw

  const startNum = parseFiniteNumberFromResolved({
    text: resolveTemplate(startingNumberTemplate, context),
    fieldLabel: 'Execution "Starting number"',
  })

  const incrementTemplateRaw =
    typeof data?.iterationIncrement === "string" ? data.iterationIncrement : DEFAULT_ITERATION_INCREMENT_EXPRESSION
  const incrementTemplate = incrementTemplateRaw.trim() === "" ? DEFAULT_ITERATION_INCREMENT_EXPRESSION : incrementTemplateRaw.trim()
  const incrementResolvedStr = resolveTemplate(incrementTemplate, context)
  let increment = Number(incrementResolvedStr.trim())
  if (!Number.isFinite(increment)) {
    increment = 1
  }

  const nextNumber = startNum + increment

  const exeContext: Record<string, unknown> = { number: nextNumber, starting_number: startNum, increment }
  const outputContext = { ...context, exe: exeContext }
  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema, context: outputContext })

  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "iteration",
    node_id: node.id,
    label,
    ok: true,
    ...resolvedOutputs,
    outputs: resolvedOutputs,
    exe: exeContext,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
