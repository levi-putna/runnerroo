/**
 * Executes an `ai` node with `subtype === "generate"` (text generation).
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

/**
 * Resolves template tags in the prompt, calls `generateText`, and returns structured output
 * matching the `{{exe.*}}` tag namespace used in outputSchema values.
 */
export async function executeAiGenerateStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput: unknown
}): Promise<Record<string, unknown>> {
  const data = node.data as Record<string, unknown> | undefined
  const label = typeof data?.label === "string" ? data.label : node.id
  const rawModelId =
    typeof data?.model === "string" && data.model.trim() !== ""
      ? data.model
      : DEFAULT_MODEL_ID
  const gatewayModelId = resolveWorkflowGatewayModelId({ modelId: rawModelId })
  const promptTemplate = typeof data?.prompt === "string" ? data.prompt : ""
  const systemPromptTemplate =
    typeof data?.systemPrompt === "string" ? data.systemPrompt : undefined

  const context = buildResolutionContext({ stepInput, stepId: node.id })

  const resolvedPrompt = resolveTemplate(promptTemplate, context)
  const resolvedSystem = systemPromptTemplate
    ? resolveTemplate(systemPromptTemplate, context)
    : undefined

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
    prompt: resolvedPrompt,
    ...(resolvedSystem ? { system: resolvedSystem } : {}),
    ...(providerOptions ? { providerOptions } : {}),
  })

  const inputSchema = readInputSchemaFromNodeData({ value: data?.inputSchema })
  const resolvedInputs: Record<string, unknown> = {}
  for (const field of inputSchema) {
    if (!field.value) continue
    resolvedInputs[field.key] = resolveTemplate(field.value, context)
  }

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
    inputs: resolvedInputs,
  }

  if (Object.keys(resolvedGlobals).length > 0) {
    resultPayload.globals = resolvedGlobals
  }

  return resultPayload
}
