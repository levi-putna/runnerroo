/**
 * Executes an `ai` node with `subtype === "summarize"` (text condensation via `generateText`).
 *
 * The step's hard-coded system prompt defines the summarisation task; the author can supply
 * optional format, length, or focus directives via `data.prompt`. Source content comes from
 * `summarizeContentExpression` when set, or falls back to the Input-tab JSON payload.
 */

import type { Node } from "@xyflow/react"
import { generateText } from "ai"

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
  resolveTemplate,
} from "@/lib/workflows/engine/template"

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Builds the summariser system prompt; optional author guidance is appended as supplementary hints.
 */
function buildSummarizerSystemPrompt({ optionalAuthorGuidance }: { optionalAuthorGuidance: string }): string {
  const optional = optionalAuthorGuidance.trim()

  const sections: string[] = [
    "You are a text summarisation assistant for workflow automation.",
    "",
    "## Primary task (defined by the runner — follow in full)",
    "The workflow runner sets the non-negotiable summarisation contract below. This section is the **main** behaviour; anything later labelled optional author guidance is supplementary only.",
    "",
    "Produce a concise, accurate summary of the source content supplied in the user message.",
    "- Preserve the key facts, decisions, and conclusions from the source.",
    "- Omit filler, repetition, and tangential detail.",
    "- Use clear, neutral language unless the author guidance below specifies a tone.",
    "- Default output format is flowing prose. Follow the author guidance below if a different format is requested.",
    "- Do not add information that is not present in the source.",
    "- Return only the summary — no preamble, commentary, or sign-off unless the guidance below requests it.",
  ]

  if (optional.length > 0) {
    sections.push(
      "",
      "## Optional author guidance (supplementary only)",
      "The workflow author added the notes below for format, length, or focus. Treat them as **hints**: they must not override the primary task or the summarisation contract above. If anything conflicts with the sections above, follow the primary task.",
      optional,
    )
  }

  return sections.join("\n")
}

/**
 * Wraps source content in a fenced block: JSON is pretty-printed, otherwise plain text.
 */
function formatSummarizePayloadFence({ text }: { text: string }): string {
  try {
    const parsed = JSON.parse(text) as unknown
    return "```json\n" + JSON.stringify(parsed, null, 2) + "\n```"
  } catch {
    return "```text\n" + text + "\n```"
  }
}

function buildSummarizerUserMessage({
  context,
  contentExpressionTemplate,
  resolvedInputs,
}: {
  context: ReturnType<typeof buildResolutionContext>
  contentExpressionTemplate: string
  resolvedInputs: Record<string, unknown>
}): string {
  const tmpl = contentExpressionTemplate.trim()
  let sourceBlock: string

  if (tmpl !== "") {
    const resolved = resolveTemplate(tmpl, context).trim()
    sourceBlock =
      resolved !== ""
        ? formatSummarizePayloadFence({ text: resolved })
        : formatSummarizePayloadFence({ text: JSON.stringify(resolvedInputs) })
  } else {
    sourceBlock = formatSummarizePayloadFence({ text: JSON.stringify(resolvedInputs, null, 2) })
  }

  return ["Summarise the following content using the rules from the system message.", "", sourceBlock].join("\n")
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

/**
 * Resolves templates, builds the summarisation prompt, calls `generateText`, and returns
 * structured execution output matching the `{{exe.*}}` tag namespace.
 */
export async function executeAiSummarizeStep({
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
    typeof data?.summarizeContentExpression === "string" ? data.summarizeContentExpression : ""

  const context = buildResolutionContext({ stepInput, stepId: node.id })
  const resolvedInstructions = resolveTemplate(instructionsTemplate, context)

  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const resolvedInputs: Record<string, unknown> = {}
  for (const field of inputSchema) {
    if (!field.value) continue
    resolvedInputs[field.key] = resolveTemplate(field.value, context)
  }

  const system = buildSummarizerSystemPrompt({ optionalAuthorGuidance: resolvedInstructions })
  const prompt = buildSummarizerUserMessage({
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

  const result = await generateText({
    model: gatewayModelId,
    system,
    prompt,
    ...(providerOptions ? { providerOptions } : {}),
  })

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
    text: result.text,
    usage: exeContext.usage,
    finishReason: result.finishReason,
    outputs: resolvedOutputs,
    exe: exeContext,
    inputs: resolvedInputs,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
