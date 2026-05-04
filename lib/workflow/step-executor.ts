/**
 * Server-only real step executor for workflow nodes.
 *
 * Handles actual node execution (AI generation, entry output evaluation) as opposed to
 * the client-safe simulated runner in runner.ts.
 *
 * AI generation uses `provider/model` strings routed through the Vercel AI Gateway (AI SDK).
 * Never import this module from client components.
 */

import type { Node } from "@xyflow/react"
import { generateText } from "ai"
import { readInputSchemaFromNodeData, type NodeInputField } from "@/lib/workflow/input-schema"
import { DEFAULT_MODEL_ID, resolveWorkflowGatewayModelId } from "@/lib/ai-gateway/models"
import { readGlobalsFromExecutionStepInput, type StepExecutorFn } from "@/lib/workflow/runner"

// ─── Template resolution ─────────────────────────────────────────────────────

/** Flat dot-path accessor: `get(obj, "a.b.c")` → `obj?.a?.b?.c`. */
function getByPath(obj: unknown, path: string): unknown {
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
function stringify(value: unknown): string {
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
function buildResolutionContext(stepInput: unknown): Record<string, unknown> {
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
function resolveTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, expr: string) => {
    const path = expr.trim()
    const value = getByPath(context, path)
    return stringify(value)
  })
}

/**
 * Resolves optional globals schema rows into a map for `stepOutput.globals`.
 */
function resolveGlobalsSchema({
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

// ─── Entry node execution ─────────────────────────────────────────────────────

/**
 * Evaluates an entry node's outputSchema against the trigger envelope and optional globals schema.
 * Each outputSchema field value may be a template like `{{input.name}}`.
 * Returns the resolved key→value map to be used as the step's output.
 */
function executeEntryNode({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Record<string, unknown> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id

  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })

  const context = buildResolutionContext(stepInput)

  const output: Record<string, unknown> = {
    kind: "entry_output",
    label,
    ok: true,
  }

  // Resolve each declared outputSchema field and add it to the step output
  for (const field of outputSchema) {
    if (!field.value) continue
    const resolved = resolveTemplate(field.value, context)
    output[field.key] = resolved
  }

  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context })
  if (Object.keys(resolvedGlobals).length > 0) {
    output.globals = resolvedGlobals
  }

  return output
}

// ─── AI generate node execution ───────────────────────────────────────────────

/**
 * Executes an `ai` node with `subtype === "generate"` (text generation).
 *
 * Resolves template tags in the prompt, calls `generateText`, and returns a
 * structured output matching the `{{exe.*}}` tag namespace used in outputSchema values.
 */
async function executeAiGenerateNode({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Promise<Record<string, unknown>> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  const rawModelId = typeof data?.model === "string" ? data.model : DEFAULT_MODEL_ID
  const gatewayModelId = resolveWorkflowGatewayModelId({ modelId: rawModelId })
  const promptTemplate = typeof data?.prompt === "string" ? data.prompt : ""
  const systemPromptTemplate =
    typeof data?.systemPrompt === "string" ? data.systemPrompt : undefined

  // Build resolution context from the incoming step envelope
  const context = buildResolutionContext(stepInput)

  // Resolve prompt templates
  const resolvedPrompt = resolveTemplate(promptTemplate, context)
  const resolvedSystem = systemPromptTemplate
    ? resolveTemplate(systemPromptTemplate, context)
    : undefined

  const result = await generateText({
    model: gatewayModelId,
    prompt: resolvedPrompt,
    ...(resolvedSystem ? { system: resolvedSystem } : {}),
  })

  // Evaluate inputSchema-declared keys using the resolved prompt as well
  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const resolvedInputs: Record<string, unknown> = {}
  for (const field of inputSchema) {
    if (!field.value) continue
    resolvedInputs[field.key] = resolveTemplate(field.value, context)
  }

  // Build the step output.
  // `exe.*` fields mirror GenerateTextResult so outputSchema values like `{{exe.text}}` resolve.
  const exeContext: Record<string, unknown> = {
    text: result.text,
    reasoningText: result.reasoningText ?? "",
    finishReason: result.finishReason,
    rawFinishReason: result.rawFinishReason ?? "",
    response: {
      id: result.response?.id ?? "",
      modelId: result.response?.modelId ?? gatewayModelId,
    },
    usage: {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    },
    totalUsage: {
      inputTokens: result.totalUsage?.inputTokens ?? 0,
      outputTokens: result.totalUsage?.outputTokens ?? 0,
      totalTokens: result.totalUsage?.totalTokens ?? 0,
    },
    steps: { length: result.steps?.length ?? 1 },
  }

  // Evaluate outputSchema fields so they're stored with real values on the run record
  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs: Record<string, unknown> = {}
  const outputContext = { ...context, exe: exeContext }
  for (const field of outputSchema) {
    if (!field.value) continue
    resolvedOutputs[field.key] = resolveTemplate(field.value, outputContext)
  }

  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "ai",
    node_id: node.id,
    label,
    ok: true,
    // Direct text output — always present for easy downstream access
    text: result.text,
    usage: exeContext.usage,
    finishReason: result.finishReason,
    // Resolved outputSchema fields (e.g. { text: "Hello Levi!", tokens: "123" })
    outputs: resolvedOutputs,
    // Raw AI SDK execution context (for advanced outputSchema mapping)
    exe: exeContext,
    // Resolved inputSchema values as the node received them
    inputs: resolvedInputs,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}

// ─── Random number & iteration ────────────────────────────────────────────────

/**
 * Parses a resolved expression as a finite number or throws an actionable executor error.
 */
function parseFiniteNumberFromResolved({
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
function drawUniformInclusiveBetween({ min, max }: { min: number; max: number }): number {
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
function resolveDeclaredInputsMap({
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

/**
 * Executes a `random` node: draws a number between resolved min and max.
 */
function executeRandomNumberNode({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Record<string, unknown> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  const context = buildResolutionContext(stepInput)
  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const resolvedInputs = resolveDeclaredInputsMap({ inputSchema, context })

  const minStr = resolvedInputs.min ?? ""
  const maxStr = resolvedInputs.max ?? ""
  const min = parseFiniteNumberFromResolved({ text: minStr, fieldLabel: 'Input "min"' })
  const max = parseFiniteNumberFromResolved({ text: maxStr, fieldLabel: 'Input "max"' })
  const drawn = drawUniformInclusiveBetween({ min, max })

  const exeContext: Record<string, unknown> = { number: drawn }
  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs: Record<string, unknown> = {}
  const outputContext = { ...context, exe: exeContext }
  for (const field of outputSchema) {
    if (!field.value) continue
    resolvedOutputs[field.key] = resolveTemplate(field.value, outputContext)
  }

  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "random",
    node_id: node.id,
    label,
    ok: true,
    ...resolvedOutputs,
    outputs: resolvedOutputs,
    exe: exeContext,
    inputs: resolvedInputs,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}

/**
 * Executes an `iteration` node: `starting_number` plus an increment resolved on the Execution tab (default 1).
 */
function executeIterationNode({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Record<string, unknown> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  const context = buildResolutionContext(stepInput)
  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const resolvedInputs = resolveDeclaredInputsMap({ inputSchema, context })

  const rawStart = resolvedInputs.starting_number
  if (rawStart === undefined) {
    throw new Error(
      'Add an input schema row with key "starting_number" and a mapped value before running this step.',
    )
  }
  const startNum = parseFiniteNumberFromResolved({
    text: rawStart,
    fieldLabel: 'Input "starting_number"',
  })

  const incrementTemplateRaw =
    typeof data?.iterationIncrement === "string" ? data.iterationIncrement : "1"
  const incrementTemplate = incrementTemplateRaw.trim() === "" ? "1" : incrementTemplateRaw.trim()
  const incrementResolvedStr = resolveTemplate(incrementTemplate, context)
  let increment = Number(incrementResolvedStr.trim())
  if (!Number.isFinite(increment)) {
    increment = 1
  }

  const nextNumber = startNum + increment

  const exeContext: Record<string, unknown> = { number: nextNumber }
  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs: Record<string, unknown> = {}
  const outputContext = { ...context, exe: exeContext }
  for (const field of outputSchema) {
    if (!field.value) continue
    resolvedOutputs[field.key] = resolveTemplate(field.value, outputContext)
  }

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
    inputs: resolvedInputs,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a real step executor for use with `traverseWorkflowGraph`.
 * The entry node reads trigger fields from the execution envelope on `stepInput`.
 */
export function createWorkflowStepExecutor(): StepExecutorFn {
  return async ({ node, stepInput }) => {
    const t = node.type

    // Entry node: evaluate outputSchema against trigger envelope (includes accumulated globals)
    if (t === "entry") {
      return executeEntryNode({ node, stepInput })
    }

    // AI generate node: call the model
    if (t === "ai") {
      const data = node.data as Record<string, unknown> | undefined
      const subtype = typeof data?.subtype === "string" ? data.subtype : "generate"
      if (subtype === "generate") {
        return executeAiGenerateNode({ node, stepInput })
      }
    }

    // Random number draw
    if (t === "random") {
      return executeRandomNumberNode({ node, stepInput })
    }

    // Numeric iteration (starting value + increment)
    if (t === "iteration") {
      return executeIterationNode({ node, stepInput })
    }

    // All other node types (action, code, decision, switch, split, end):
    // fall back to the simulated output shape
    const data = node.data as Record<string, unknown> | undefined
    const label = typeof data?.label === "string" ? data.label : node.id
    return {
      kind: t ?? "step_output",
      node_id: node.id,
      label,
      ok: true,
    }
  }
}
