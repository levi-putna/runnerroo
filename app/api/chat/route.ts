/**
 * Chat API — thin HTTP boundary for the assistant.
 *
 * Pipeline:
 * 1. Authenticate the Supabase user.
 * 2. Parse JSON body (`messages`, `modelId`, `conversationId`).
 * 3. Delegate to {@link runAssistantChatTurn} (memory appendix, optional planning, tools, `streamText`).
 * 4. Return a UI message stream for {@link @ai-sdk/react.useChat}.
 */

import type { UIMessage } from "ai";

import { runAssistantChatTurn } from "@/ai/agents/chat-agent";
import {
  buildRunnerGatewayProviderOptions,
  gatewayUsageTagsForConversation,
} from "@/lib/ai-gateway/runner-gateway-tracking";
import { DEFAULT_MODEL_ID } from "@/lib/ai-gateway/models";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

function resolveModelId(modelId: unknown): string {
  if (typeof modelId === "string" && modelId.trim()) {
    return modelId.trim();
  }
  return DEFAULT_MODEL_ID;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { messages?: unknown; modelId?: unknown; conversationId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawMessages = body.messages;
  if (!Array.isArray(rawMessages)) {
    return new Response(JSON.stringify({ error: "messages must be an array" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const uiMessages = rawMessages as UIMessage[];
  const modelId = resolveModelId(body.modelId);

  const conversationIdRaw =
    typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  const conversationId = conversationIdRaw.length > 0 ? conversationIdRaw : null;

  const gatewayProviderOptions = buildRunnerGatewayProviderOptions({
    supabaseUserId: user.id,
    tags: gatewayUsageTagsForConversation({ conversationId }),
  });

  const result = await runAssistantChatTurn({
    supabase,
    userId: user.id,
    uiMessages,
    modelId,
    conversationId,
    gatewayProviderOptions,
  });

  return result.toUIMessageStreamResponse();
}
