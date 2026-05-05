import { gateway } from "@ai-sdk/gateway";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
} from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { runPlanningAgent } from "@/ai/agents/planning-agent";
import { buildRunnerAssistantInstructions } from "@/ai/skills";
import { createAssistantTools } from "@/ai/tools";
import { searchMemory } from "@/lib/memories/memory-service";

const PLANNING_ENV = "RUNNER_ASSISTANT_PLANNING";

/**
 * Builds the optional memory appendix injected into the system prompt (semantic search over pgvector).
 *
 * @returns Markdown fragment or an empty string when nothing matched or on non-fatal errors.
 */
async function buildMemoryContextAppendix({
  supabase,
  userId,
  uiMessages,
  conversationId,
}: {
  supabase: SupabaseClient;
  userId: string;
  uiMessages: UIMessage[];
  conversationId: string | null;
}): Promise<string> {
  try {
    const lastUserMessage = [...uiMessages].reverse().find((m) => m.role === "user");
    const queryText = lastUserMessage?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join(" ")
      .trim();

    if (!queryText) return "";

    const memories = await searchMemory({
      supabase,
      userId,
      query: queryText,
      conversationId,
      limit: 8,
    });

    if (memories.length === 0) return "";

    return `\n\n## Relevant memories about this user\n${memories
      .map((m) => `- [${m.type}] ${m.key}: ${m.content}`)
      .join("\n")}`;
  } catch {
    return "";
  }
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
 * tool registry, and {@link streamText} with multi-step tool loops enabled.
 */
export async function runAssistantChatTurn({
  supabase,
  userId,
  uiMessages,
  modelId,
  conversationId,
  gatewayProviderOptions,
}: RunAssistantChatTurnParams) {
  const memoryContext = await buildMemoryContextAppendix({
    supabase,
    userId,
    uiMessages,
    conversationId,
  });

  const planningEnabled = process.env[PLANNING_ENV] === "true";
  const planning = planningEnabled
    ? await runPlanningAgent(uiMessages, { providerOptions: gatewayProviderOptions })
    : undefined;

  const { tools, integrationsBrief } = await createAssistantTools({
    supabase,
    userId,
  });

  const system = buildRunnerAssistantInstructions({
    planning,
    memoryContext: memoryContext || undefined,
    integrationsContext:
      integrationsBrief.summaryLines.length > 0
        ? integrationsBrief.summaryLines.map((l) => `- ${l}`).join("\n")
        : undefined,
  });

  const modelMessages = await convertToModelMessages(uiMessages);

  return streamText({
    model: gateway.languageModel(modelId),
    system,
    messages: modelMessages,
    tools,
    providerOptions: gatewayProviderOptions,
    stopWhen: stepCountIs(15),
  });
}
