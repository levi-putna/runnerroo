import { gateway } from "@ai-sdk/gateway";
import type { LanguageModelV3Usage } from "@ai-sdk/provider";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type LanguageModelUsage,
  type TextStreamPart,
  type ToolSet,
  type UIMessage,
} from "ai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
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
import {
  runAssistantMemoryRetrieval,
  type RunAssistantMemoryRetrievalResult,
} from "@/ai/agents/memory-retrieval-agent";
import { getAiGatewayModelListCached } from "@/lib/ai-gateway/gateway-raw-models";
import { memoryRetrievedRowsToSidebarPreviewItems } from "@/lib/conversations/sidebar-memory-preview";
import { getAssistantSettings } from "@/lib/assistant-settings/assistant-settings-service";

const PLANNING_ENV = "RUNNER_ASSISTANT_PLANNING";

export type RunAssistantChatTurnParams = {
  supabase: SupabaseClient;
  userId: string;
  uiMessages: UIMessage[];
  modelId: string;
  conversationId: string | null;
  gatewayProviderOptions: ProviderOptions | undefined;
  /** When set, skips in-turn retrieval (caller already ran {@link runAssistantMemoryRetrieval}). */
  memoryTurn?: RunAssistantMemoryRetrievalResult;
};

/** V3 stream `finish.usage` shape for the mock model stream (matches provider contract). */
const ASSISTANT_PING_MOCK_V3_USAGE: LanguageModelV3Usage = {
  inputTokens: { total: 1000, noCache: 1000, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 2000, text: 2000, reasoning: undefined },
};

/**
 * Rounded synthetic token counts for the `ping` → `pong` mock path (no real LLM call).
 * Chosen as round thousands so session usage is easy to spot as mock data.
 */
export const ASSISTANT_PING_MOCK_USAGE: LanguageModelUsage = {
  inputTokens: 1000,
  outputTokens: 2000,
  totalTokens: 3000,
  inputTokenDetails: {
    noCacheTokens: 1000,
    cacheReadTokens: undefined,
    cacheWriteTokens: undefined,
  },
  outputTokenDetails: {
    textTokens: 2000,
    reasoningTokens: undefined,
  },
};

/**
 * When the latest user turn is exactly `ping` (trimmed), the route skips real models and returns `pong`.
 */
export function isAssistantPingShortcutMessage({ queryText }: { queryText: string }): boolean {
  return queryText === "ping";
}

/**
 * Streams a fixed `pong` assistant reply with {@link ASSISTANT_PING_MOCK_USAGE} attributed to `modelId`.
 */
async function runAssistantPingMockStreamTurn({
  uiMessages,
  modelId,
  catalogue,
}: {
  uiMessages: UIMessage[];
  modelId: string;
  catalogue: Awaited<ReturnType<typeof getAiGatewayModelListCached>>;
}) {
  const modelMessages = await convertToModelMessages(uiMessages);

  const mockModel = new MockLanguageModelV3({
    provider: "dailify-mock",
    modelId,
    doStream: async () => ({
      stream: simulateReadableStream({
        initialDelayInMs: null,
        chunkDelayInMs: null,
        chunks: [
          { type: "text-start", id: "dailify-ping" },
          { type: "text-delta", id: "dailify-ping", delta: "pong" },
          { type: "text-end", id: "dailify-ping" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            logprobs: undefined,
            usage: ASSISTANT_PING_MOCK_V3_USAGE,
          },
        ],
      }),
    }),
  });

  const streamResult = streamText({
    model: mockModel,
    messages: modelMessages,
    stopWhen: stepCountIs(1),
  });

  const messageMetadata = ({
    part,
  }: {
    part: TextStreamPart<ToolSet>;
  }): AssistantMessageMetadata | undefined => {
    if (part.type !== "finish") return undefined;
    const assistantUsage = part.totalUsage ?? ASSISTANT_PING_MOCK_USAGE;
    return buildRunnerAssistantUsageMetadata({
      planningUsage: undefined,
      planningModelId: resolvePlanningModelId(),
      assistantUsage,
      assistantModelId: modelId,
      catalogue,
      memoriesRetrieved: [],
    });
  };

  return {
    streamResult,
    messageMetadata,
    memoryTurn: {
      retrievedMemories: [],
      memoryFactsBlock: "",
      memoriesRetrieved: [],
    },
  };
}

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
  memoryTurn: memoryTurnBootstrap,
}: RunAssistantChatTurnParams) {
  const lastUserMessage = [...uiMessages].reverse().find((m) => m.role === "user");
  const queryText =
    lastUserMessage?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join(" ")
      .trim() ?? "";

  let catalogue: Awaited<ReturnType<typeof getAiGatewayModelListCached>> = [];
  try {
    catalogue = await getAiGatewayModelListCached();
  } catch {
    catalogue = [];
  }

  if (isAssistantPingShortcutMessage({ queryText })) {
    return runAssistantPingMockStreamTurn({ uiMessages, modelId, catalogue });
  }

  const memoryTurn =
    memoryTurnBootstrap ??
    (await runAssistantMemoryRetrieval({
      supabase,
      userId,
      uiMessages,
      conversationId,
      limit: 8,
      gatewayProviderOptions,
    }));
  const memoryContext =
    memoryTurn.memoryFactsBlock.trim().length > 0 ? memoryTurn.memoryFactsBlock : "";
  const memoriesRetrieved = memoryRetrievedRowsToSidebarPreviewItems({
    rows: memoryTurn.memoriesRetrieved,
  }).map((row) => ({
    id: row.id,
    type: row.type,
    key: row.key ?? row.type,
    preview: row.preview,
  }));

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

  const [{ tools, integrationsBrief, workflowsInvokeBrief }, assistantSettings] = await Promise.all([
    createAssistantTools({
      supabase,
      userId,
      conversationId,
      ...(invokeDescriptorsForPlanningTurn !== undefined
        ? { cachedInvokeDescriptors: invokeDescriptorsForPlanningTurn }
        : {}),
    }),
    getAssistantSettings({ supabase, userId }),
  ]);

  const system = buildRunnerAssistantInstructions({
    planning,
    memoryContext: memoryContext.length > 0 ? memoryContext : undefined,
    integrationsContext:
      integrationsBrief.summaryLines.length > 0
        ? integrationsBrief.summaryLines.map((l) => `- ${l}`).join("\n")
        : undefined,
    workflowsInvokeContext:
      workflowsInvokeBrief.summaryLines.length > 0
        ? workflowsInvokeBrief.summaryLines.join("\n")
        : undefined,
    assistantSettings,
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

  return { streamResult, messageMetadata, memoryTurn };
}
