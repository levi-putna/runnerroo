/**
 * Executes an `ai` node with `subtype === "classify"` (structured category selection via `generateObject`).
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
  parseClassifyLabelCatalogueFromResolvedText,
  readPersistedClassifyLabelsFromNode,
  serialiseClassifyCatalogueForPrompt,
  type ClassifyCatalogueEntry,
} from "@/lib/workflows/steps/ai/classify/catalogue"
import {
  buildResolutionContext,
  resolveGlobalsSchema,
  resolveTemplate,
} from "@/lib/workflows/engine/template"

function buildClassifierZodSchema({ allowedLabels }: { allowedLabels: string[] }) {
  const [head, ...tail] = allowedLabels
  if (head === undefined || head.trim() === "") {
    throw new Error("Provide at least one non-empty classify label.")
  }

  const labelEnum = z.enum([head, ...tail] as [string, ...string[]]).describe(
    "Chosen category identifier — MUST exactly match one `label` from the injected catalogue.",
  )

  const confidenceSchema = z.coerce
    .number()
    .min(0)
    .max(1)
    .describe(
      "Subjective certainty between 0 and 1 that the chosen label is correct. Use decimals (e.g. 0.85). Prefer lower values when evidence is ambiguous or incomplete.",
    )

  const reasoningSchema = z
    .string()
    .describe(
      "2–6 sentences quoting or paraphrasing concrete evidence from the payload that justify the classification. Mention which fields or snippets drive the decision, and briefly note ambiguity or close alternatives when relevant.",
    )
    .min(1)

  return z.object({
    label: labelEnum,
    confidence: confidenceSchema,
    reasoning: reasoningSchema,
  })
}

/**
 * Builds the classifier system message: mandatory runner-defined task first, catalogue, then optional author hints.
 */
function buildClassifierSystemPrompt({
  optionalAuthorGuidance,
  catalogueJson,
}: {
  optionalAuthorGuidance: string
  catalogueJson: string
}): string {
  const optional = optionalAuthorGuidance.trim()
  const sections: string[] = [
    "You are an expert classifier for workflow automation.",
    "",
    "## Primary task (defined by the runner — follow in full)",
    "The workflow runner sets the non-negotiable classification contract below. This section is the **main** behaviour; anything later labelled optional author guidance is supplementary only.",
    "",
    "You categorise the payload supplied in the user message into **exactly one** category from the catalogue in this system message.",
    "- Read every supplied field carefully. Where evidence is ambiguous, use sensible judgement and pick the strongest single overall match.",
    "- Each catalogue entry has a `label` (exact string you must emit in the structured `label` field) and `description` (when that category applies).",
    "- **One label only** — no multi-label outputs.",
    "- The structured `label` must match a catalogue `label` **verbatim** (character-for-character) unless optional author guidance below explicitly documents an allowed normalisation.",
    "- When signals conflict across fields, prefer the best overall fit; explain trade-offs briefly in `reasoning`.",
    "- If the fit is weak, prefer a catalogue entry whose description indicates catch-all, “other”, or broadly mixed content when one exists; otherwise pick the least-wrong explicit category with a clearly lower `confidence`.",
    "- `confidence` is subjective self-assessment (0 = guessing, 1 = very confident), not a calibrated probability.",
    "",
    "## Category catalogue",
    "Each JSON object contains a `label` (exact identifier you must emit in the structured `label` field) and `description` (when to choose that category).",
    catalogueJson,
    "",
    "## Output discipline",
    "- Return only the structured JSON object required by the schema (no preamble, markdown fences, or commentary outside the schema).",
    "- Do not invent labels outside the catalogue; document uncertainty with `confidence` and `reasoning` instead.",
  ]

  if (optional.length > 0) {
    sections.push(
      "",
      "## Optional author guidance (supplementary only)",
      "The workflow author added the notes below for extra domain context. Treat them as **hints**: they must not override the primary task, catalogue identifiers, the single-label rule, or the structured output schema. If anything conflicts with the sections above, follow the primary task and catalogue.",
      optional,
    )
  }

  return sections.join("\n")
}

function buildClassifierUserPrompt({ payloadPrettyJson }: { payloadPrettyJson: string }): string {
  return [
    "Apply the primary task, catalogue, and output rules from the system message to the structured payload below.",
    "",
    "```json",
    payloadPrettyJson,
    "```",
  ].join("\n")
}

/**
 * Wraps resolved author content in a fenced block — pretty-printed JSON when parsable, otherwise plain text.
 */
function formatClassifierPayloadFenceFromText({ text }: { text: string }): string {
  try {
    const parsed = JSON.parse(text) as unknown
    return "```json\n" + JSON.stringify(parsed, null, 2) + "\n```"
  } catch {
    return "```text\n" + text + "\n```"
  }
}

/**
 * User message when the Execution tab “content to classify” expression supplies the payload.
 */
function buildClassifierUserPromptFromResolvedContent({ text }: { text: string }): string {
  return [
    "Apply the primary task, catalogue, and output rules from the system message to the payload below.",
    "",
    formatClassifierPayloadFenceFromText({ text }),
  ].join("\n")
}

interface BuildClassifierUserMessageParams {
  context: ReturnType<typeof buildResolutionContext>
  contentExpressionTemplate: string
  resolvedInputs: Record<string, unknown>
}

/**
 * Prefers a non-empty resolved {@link BuildClassifierUserMessageParams.contentExpressionTemplate};
 * otherwise serialises {@link BuildClassifierUserMessageParams.resolvedInputs} as the structured JSON payload.
 */
function buildClassifierUserMessage({
  context,
  contentExpressionTemplate,
  resolvedInputs,
}: BuildClassifierUserMessageParams): string {
  const tmpl = contentExpressionTemplate.trim()
  if (tmpl !== "") {
    const resolved = resolveTemplate(tmpl, context).trim()
    if (resolved !== "") {
      return buildClassifierUserPromptFromResolvedContent({ text: resolved })
    }
  }
  const payloadPrettyJson = JSON.stringify(resolvedInputs, null, 2)
  return buildClassifierUserPrompt({ payloadPrettyJson })
}

function resolveClassifyCatalogue({
  data,
  context,
}: {
  data: Record<string, unknown> | undefined
  context: ReturnType<typeof buildResolutionContext>
}): ClassifyCatalogueEntry[] {
  const fromExpr = Boolean(data?.classifyLabelsFromExpression)
  if (fromExpr) {
    const tmpl = typeof data?.classifyLabelsExpression === "string" ? data.classifyLabelsExpression : ""
    const resolved = resolveTemplate(tmpl, context).trim()
    return parseClassifyLabelCatalogueFromResolvedText({ text: resolved })
  }
  return readPersistedClassifyLabelsFromNode({ value: data?.classifyLabels })
}

/**
 * Calls the gateway model with a structured classification schema and returns execution + mapped outputs.
 */
export async function executeAiClassifyStep({
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

  const context = buildResolutionContext(stepInput)
  const resolvedInstructions = resolveTemplate(instructionsTemplate, context)

  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const resolvedInputs: Record<string, unknown> = {}
  for (const field of inputSchema) {
    if (!field.value) continue
    resolvedInputs[field.key] = resolveTemplate(field.value, context)
  }

  const catalogue = resolveClassifyCatalogue({ data, context })
  if (catalogue.length === 0) {
    throw new Error(
      "Classify step needs at least one category — add labels in the Execution tab or supply valid JSON via the labels expression.",
    )
  }

  const allowedLabels = catalogue.map((c) => c.label)
  const schema = buildClassifierZodSchema({ allowedLabels })
  const catalogueJson = serialiseClassifyCatalogueForPrompt({ entries: catalogue })
  const system = buildClassifierSystemPrompt({
    optionalAuthorGuidance: resolvedInstructions,
    catalogueJson,
  })
  const contentExpressionTemplate = typeof data?.classifyContentExpression === "string" ? data.classifyContentExpression : ""
  const prompt = buildClassifierUserMessage({
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

  const exeContext: Record<string, unknown> = {
    classifier_label: object.label,
    classifier_confidence: object.confidence,
    classifier_reasoning: object.reasoning,
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
    classification: {
      label: object.label,
      confidence: object.confidence,
      reasoning: object.reasoning,
    },
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
