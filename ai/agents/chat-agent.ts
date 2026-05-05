import { gateway } from "@ai-sdk/gateway";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type TextStreamPart,
  type ToolSet,
  type UIMessage,
} from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { runPlanningAgent, resolvePlanningModelId } from "@/ai/agents/planning-agent";
import { buildRunnerAssistantInstructions } from "@/ai/skills";
import { createAssistantTools } from "@/ai/tools";
import { buildRunnerAssistantUsageMetadata } from "@/lib/assistant/build-runner-assistant-usage-metadata";
import type { AssistantMessageMetadata } from "@/lib/assistant/chat-usage-metadata";
import {
  formatInvokeWorkflowDescriptorsForPlanningPrompt,
  listWorkflowAssistantInvokeDescriptors,
} from "@/lib/workflows/assistant-workflow-invoke-support";
import { getAiGatewayModelListCached } from "@/lib/ai-gateway/gateway-raw-models";
import { searchMemory } from "@/lib/memories/memory-service";
import type { MemoryHybridMatch } from "@/lib/memories/types";

const PLANNING_ENV = "RUNNER_ASSISTANT_PLANNING";

/**
 * Formats retrieved memories for the system prompt appendix.
 */
function buildMemoryContextAppendixFromMatches(memories: MemoryHybridMatch[]): string {
  if (memories.length === 0) return "";
  return `\n\n## Relevant memories about this user\n${memories
    .map((m) => `- [${m.type}] ${m.key}: ${m.content}`)
    .join("\n")}`;
}

export type RunAssistantChatTurnParams = {
  supabase: SupabaseClient;
  userId: string;
  uiMessages: UIMessage[];
  modelId: string;
  conversationId: string | null;
  gatewayProviderOptions: ProviderOptions | undefined;
};

/**
 * Single entry point for the HTTP chat route: memory retrieval, optional planning pass,
 * tool registry, and {@link streamText} with multi-step `stopWhen` plus UI message metadata for usage.
 */
export async function runAssistantChatTurn({
  supabase,
  userId,
  uiMessages,
  modelId,
  conversationId,
  gatewayProviderOptions,
}: RunAssistantChatTurnParams) {
  const lastUserMessage = [...uiMessages].reverse().find((m) => m.role === "user");
  const queryText =
    lastUserMessage?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join(" ")
      .trim() ?? "";

  let retrievedMemories: MemoryHybridMatch[] = [];
  if (queryText.length > 0) {
    try {
      retrievedMemories = await searchMemory({
        supabase,
        userId,
        query: queryText,
        conversationId,
        limit: 8,
      });
    } catch {
      retrievedMemories = [];
    }
  }

  const memoryContext = buildMemoryContextAppendixFromMatches(retrievedMemories);
  const memoriesRetrieved = retrievedMemories.slice(0, 10).map((m) => ({
    id: m.id,
    type: m.type,
    key: m.key,
    preview: m.content,
  }));

  let catalogue: Awaited<ReturnType<typeof getAiGatewayModelListCached>> = [];
  try {
    catalogue = await getAiGatewayModelListCached();
  } catch {
    catalogue = [];
  }

  const planningEnabled = process.env[PLANNING_ENV] === "true";

  const invokeDescriptorsForPlanningTurn = planningEnabled
    ? await listWorkflowAssistantInvokeDescriptors({ supabase, userId })
    : undefined;

  const planning = planningEnabled
    ? await runPlanningAgent(uiMessages, {
        providerOptions: gatewayProviderOptions,
        invokeWorkflowsPlanningAppendix:
          invokeDescriptorsForPlanningTurn && invokeDescriptorsForPlanningTurn.length > 0
            ? formatInvokeWorkflowDescriptorsForPlanningPrompt({
                descriptors: invokeDescriptorsForPlanningTurn,
              })
            : undefined,
      })
    : undefined;

  const { tools, integrationsBrief, workflowsInvokeBrief } = await createAssistantTools({
    supabase,
    userId,
    ...(invokeDescriptorsForPlanningTurn !== undefined
      ? { cachedInvokeDescriptors: invokeDescriptorsForPlanningTurn }
      : {}),
  });

  const system = buildRunnerAssistantInstructions({
    planning,
    memoryContext: memoryContext || undefined,
    integrationsContext:
      integrationsBrief.summaryLines.length > 0
        ? integrationsBrief.summaryLines.map((l) => `- ${l}`).join("\n")
        : undefined,
    workflowsInvokeContext:
      workflowsInvokeBrief.summaryLines.length > 0
        ? workflowsInvokeBrief.summaryLines.join("\n")
        : undefined,
  });

  const modelMessages = await convertToModelMessages(uiMessages);

  const streamResult = streamText({
    model: gateway.languageModel(modelId),
    system,
    messages: modelMessages,
    tools,
    providerOptions: gatewayProviderOptions,
    stopWhen: stepCountIs(15),
  });

  const messageMetadata = ({
    part,
  }: {
    part: TextStreamPart<ToolSet>;
  }): AssistantMessageMetadata | undefined => {
    if (part.type !== "finish") return undefined;
    return buildRunnerAssistantUsageMetadata({
      planningUsage: planning?.usage,
      planningModelId: resolvePlanningModelId(),
      assistantUsage: part.totalUsage,
      assistantModelId: modelId,
      catalogue,
      memoriesRetrieved,
    });
  };

  return { streamResult, messageMetadata };
}
