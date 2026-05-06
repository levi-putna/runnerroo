/**
 * Executes an `ai` node with `subtype === "extract"` (structured data extraction via `generateObject`).
 *
 * The Zod schema is built dynamically from the author-defined `extractFields` rows so downstream
 * steps can reference extracted values as `{{exe.<key>}}` in the Output schema.
 */

import type { Node } from "@xyflow/react"
import { generateObject } from "ai"
import { z } from "zod"

import {
  buildRunnerGatewayProviderOptions,
  gatewayUsageTagsForWorkflowRun,
  readRunnerGatewayExecutionContextFromStepInput,
} from "@/lib/ai-gateway/runner-gateway-tracking"
import { DEFAULT_MODEL_ID, resolveWorkflowGatewayModelId } from "@/lib/ai-gateway/models"
import { readInputSchemaFromNodeData } from "@/lib/workflows/engine/input-schema"
import {
  buildResolutionContext,
  resolveGlobalsSchema,
  resolveOutputSchemaFields,
  resolveTemplate,
} from "@/lib/workflows/engine/template"
import {
  type ExtractFieldRow,
  type ExtractFieldType,
  readExtractFieldRowsFromNodeData,
} from "@/lib/workflows/steps/ai/extract/defaults"

// ---------------------------------------------------------------------------
// Zod schema builder
// ---------------------------------------------------------------------------

function zodBaseForType({ type }: { type: ExtractFieldType }): z.ZodTypeAny {
  switch (type) {
    case "number":
      return z.coerce.number()
    case "boolean":
      return z.boolean()
    case "text":
    case "string":
    default:
      return z.string()
  }
}

/**
 * Builds a dynamic Zod object schema from the author-declared extraction fields.
 * Required fields are non-nullable; optional fields allow `null` (model may not find the value).
 */
function buildExtractZodSchema({ fields }: { fields: ExtractFieldRow[] }): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of fields) {
    const base = zodBaseForType({ type: field.type }).describe(
      field.description.trim() ||
        `Extract the "${field.label}" value from the supplied content. Return null when not present.`,
    )
    shape[field.key] = field.required ? base : base.nullable().optional()
  }
  return z.object(shape)
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Builds the extractor system message: runner-owned task first, field list, then optional author guidance.
 */
function buildExtractorSystemPrompt({
  fields,
  optionalAuthorGuidance,
}: {
  fields: ExtractFieldRow[]
  optionalAuthorGuidance: string
}): string {
  const optional = optionalAuthorGuidance.trim()

  const fieldList = fields
    .map((f) => {
      const req = f.required ? "required" : "optional"
      const desc = f.description.trim()
      return `- **${f.key}** (${f.type}, ${req})${desc ? `: ${desc}` : ""}`
    })
    .join("\n")

  const sections: string[] = [
    "You are a structured data extraction assistant for workflow automation.",
    "",
    "## Primary task (defined by the runner — follow in full)",
    "The workflow runner sets the non-negotiable extraction contract below. This section is the **main** behaviour; anything later labelled optional author guidance is supplementary only.",
    "",
    "Extract the following fields from the content supplied in the user message and return them as a single JSON object matching the schema.",
    "- Extract values verbatim or with minimal normalisation unless the field description says otherwise.",
    "- For **required** fields: always return a value, even if you must infer it from context.",
    "- For **optional** fields: return `null` when you cannot find or confidently infer the value — do not fabricate.",
    "- Do not add fields that are not listed below.",
    "- Preserve data types as declared (string, number, boolean).",
    "",
    "## Fields to extract",
    fieldList,
    "",
    "## Output discipline",
    "- Return only the structured JSON object required by the schema (no preamble, markdown fences, or commentary outside the schema).",
    "- Use `null` for optional fields that are absent — never omit keys from the object.",
  ]

  if (optional.length > 0) {
    sections.push(
      "",
      "## Optional author guidance (supplementary only)",
      "The workflow author added the notes below for extra domain context. Treat them as **hints**: they must not override the primary task, the declared field list, or the structured output schema. If anything conflicts with the sections above, follow the primary task.",
      optional,
    )
  }

  return sections.join("\n")
}

/**
 * Wraps resolved content in a fenced block: JSON is pretty-printed, otherwise plain text.
 */
function formatExtractPayloadFence({ text }: { text: string }): string {
  try {
    const parsed = JSON.parse(text) as unknown
    return "```json\n" + JSON.stringify(parsed, null, 2) + "\n```"
  } catch {
    return "```text\n" + text + "\n```"
  }
}

function buildExtractorUserMessage({
  context,
  contentExpressionTemplate,
  resolvedInputs,
}: {
  context: ReturnType<typeof buildResolutionContext>
  contentExpressionTemplate: string
  resolvedInputs: Record<string, unknown>
}): string {
  const tmpl = contentExpressionTemplate.trim()
  if (tmpl !== "") {
    const resolved = resolveTemplate(tmpl, context).trim()
    if (resolved !== "") {
      return [
        "Extract the declared fields from the content below using the field list and rules from the system message.",
        "",
        formatExtractPayloadFence({ text: resolved }),
      ].join("\n")
    }
  }

  const payloadPrettyJson = JSON.stringify(resolvedInputs, null, 2)
  return [
    "Extract the declared fields from the structured payload below using the field list and rules from the system message.",
    "",
    "```json",
    payloadPrettyJson,
    "```",
  ].join("\n")
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

/**
 * Calls the gateway model with a dynamic extraction schema built from `node.data.extractFields`
 * and returns structured execution output + mapped outputs.
 */
export async function executeAiExtractStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Promise<Record<string, unknown>> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  const rawModelId =
    typeof data?.model === "string" && data.model.trim() !== "" ? data.model : DEFAULT_MODEL_ID
  const gatewayModelId = resolveWorkflowGatewayModelId({ modelId: rawModelId })
  const instructionsTemplate = typeof data?.prompt === "string" ? data.prompt : ""
  const contentExpressionTemplate =
    typeof data?.extractContentExpression === "string" ? data.extractContentExpression : ""

  const context = buildResolutionContext({ stepInput, stepId: node.id })
  const resolvedInstructions = resolveTemplate(instructionsTemplate, context)

  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const resolvedInputs: Record<string, unknown> = {}
  for (const field of inputSchema) {
    if (!field.value) continue
    resolvedInputs[field.key] = resolveTemplate(field.value, context)
  }

  const extractFields = readExtractFieldRowsFromNodeData({ value: data?.extractFields })
  if (extractFields.length === 0) {
    throw new Error(
      "Extract step needs at least one field — add rows in the Execution tab.",
    )
  }

  const schema = buildExtractZodSchema({ fields: extractFields })
  const system = buildExtractorSystemPrompt({
    fields: extractFields,
    optionalAuthorGuidance: resolvedInstructions,
  })
  const prompt = buildExtractorUserMessage({
    context,
    contentExpressionTemplate,
    resolvedInputs,
  })

  const gatewayCtx = readRunnerGatewayExecutionContextFromStepInput({ stepInput })
  const providerOptions =
    gatewayCtx !== null
      ? buildRunnerGatewayProviderOptions({
          supabaseUserId: gatewayCtx.supabaseUserId,
          tags: gatewayUsageTagsForWorkflowRun({
            workflowRunId: gatewayCtx.workflowRunId,
          }),
        })
      : undefined

  const { object, usage, finishReason, response } = await generateObject({
    model: gatewayModelId,
    system,
    prompt,
    schema,
    ...(providerOptions ? { providerOptions } : {}),
  })

  // Build exe context: one key per extracted field, plus telemetry
  const exeContext: Record<string, unknown> = {
    ...object,
    finishReason: finishReason ?? "",
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
    },
    response: {
      id: response?.id ?? "",
      modelId: response?.modelId ?? gatewayModelId,
    },
  }

  const outputContext = { ...context, exe: exeContext }
  const outputSchema = readInputSchemaFromNodeData({ value: data?.outputSchema })
  const resolvedOutputs = resolveOutputSchemaFields({ outputSchema, context: outputContext })

  const globalsSchema = readInputSchemaFromNodeData({ value: data?.globalsSchema })
  const resolvedGlobals = resolveGlobalsSchema({ globalsSchema, context: outputContext })

  const resultPayload: Record<string, unknown> = {
    kind: "ai",
    node_id: node.id,
    label,
    ok: true,
    extraction: object,
    usage: exeContext.usage,
    finishReason: exeContext.finishReason,
    outputs: resolvedOutputs,
    exe: exeContext,
    inputs: resolvedInputs,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
