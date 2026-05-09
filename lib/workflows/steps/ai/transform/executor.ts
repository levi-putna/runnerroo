/**
 * Executes an `ai` node with `subtype === "transform"` (text / data rewriting via `generateText`).
 *
 * The author supplies the transformation instructions as the primary prompt; the step's hard-coded
 * system message frames the task so the model behaves as a rewriting assistant rather than a
 * free-form text generator.
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
  resolveOutputSchemaFields,
  resolveTemplate,
} from "@/lib/workflows/engine/template"

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const TRANSFORMER_SYSTEM_PROMPT = [
  "You are a data transformation assistant for workflow automation.",
  "",
  "## Primary task (defined by the runner — follow in full)",
  "The workflow runner sets the non-negotiable transformation contract below.",
  "",
  "Apply the transformation instructions supplied in the user message to the source content provided.",
  "- Output only the transformed result; do not include preamble, commentary, or explanation unless the instructions explicitly request it.",
  "- Preserve the intended format of the output unless the instructions say otherwise (e.g. if the source is JSON and the instructions ask for JSON, return valid JSON; if plain text, return plain text).",
  "- Do not add extra fields, keys, or content not present in the source unless the instructions explicitly ask you to.",
  "- Apply the instructions faithfully and completely — do not truncate or partially transform the content.",
].join("\n")

/**
 * Wraps the source content in a fenced block: JSON is pretty-printed, otherwise plain text.
 */
function formatTransformPayloadFence({ text }: { text: string }): string {
  try {
    const parsed = JSON.parse(text) as unknown
    return "```json\n" + JSON.stringify(parsed, null, 2) + "\n```"
  } catch {
    return "```text\n" + text + "\n```"
  }
}

function buildTransformerUserMessage({
  instructions,
  context,
  contentExpressionTemplate,
  inboundInput,
}: {
  instructions: string
  context: ReturnType<typeof buildResolutionContext>
  contentExpressionTemplate: string
  inboundInput: Record<string, unknown>
}): string {
  const tmpl = contentExpressionTemplate.trim()
  let sourceBlock: string

  /**
   * Fallback when no explicit content expression is set: serialise the inbound predecessor
   * payload (`{{input.*}}`) as JSON so the transformer sees the upstream step's emitted output.
   */
  const inboundFallbackJson = JSON.stringify(inboundInput, null, 2)

  if (tmpl !== "") {
    const resolved = resolveTemplate(tmpl, context).trim()
    sourceBlock =
      resolved !== ""
        ? formatTransformPayloadFence({ text: resolved })
        : formatTransformPayloadFence({ text: inboundFallbackJson })
  } else {
    sourceBlock = formatTransformPayloadFence({ text: inboundFallbackJson })
  }

  const parts: string[] = ["## Transformation instructions", instructions.trim() || "(none provided)"]

  parts.push("", "## Source content", sourceBlock)

  return parts.join("\n")
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

/**
 * Resolves templates, builds the transformation prompt, calls `generateText`, and returns
 * structured execution output matching the `{{exe.*}}` tag namespace.
 */
export async function executeAiTransformStep({
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
    typeof data?.transformContentExpression === "string" ? data.transformContentExpression : ""

  const context = buildResolutionContext({ stepInput, stepId: node.id })
  const resolvedInstructions = resolveTemplate(instructionsTemplate, context)

  const inboundInput =
    context.input && typeof context.input === "object" && !Array.isArray(context.input)
      ? (context.input as Record<string, unknown>)
      : {}

  const prompt = buildTransformerUserMessage({
    instructions: resolvedInstructions,
    context,
    contentExpressionTemplate,
    inboundInput,
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
    system: TRANSFORMER_SYSTEM_PROMPT,
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
    text: result.text,
    usage: exeContext.usage,
    finishReason: result.finishReason,
    outputs: resolvedOutputs,
    exe: exeContext,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
