/**
 * Chat API — thin HTTP boundary for the assistant.
 *
 * Pipeline:
 * 1. Authenticate the Supabase user.
 * 2. Parse JSON body (`messages`, `modelId`, `conversationId`).
 * 3. On the first turn, generate a short conversation title via a fast model and stream it as
 *    a `data-conversation-title` chunk so the UI can display it immediately.
 * 4. Delegate to {@link runAssistantChatTurn} (memory appendix, optional planning, tools, `streamText`).
 * 5. Return a UI message stream for {@link @ai-sdk/react.useChat}.
 */

import {
  generateText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { gateway } from "@ai-sdk/gateway";

import { runAssistantChatTurn } from "@/ai/agents/chat-agent";
import {
  buildRunnerGatewayProviderOptions,
  gatewayUsageTagsForConversation,
} from "@/lib/ai-gateway/runner-gateway-tracking";
import { DEFAULT_MODEL_ID } from "@/lib/ai-gateway/models";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Title generation model — fast/cheap nano model for low-latency titling. */
const TITLE_MODEL_ID = "openai/gpt-5.4-nano";

/** Maximum characters for a generated conversation title. */
const TITLE_MAX_CHARS = 60;

function resolveModelId(modelId: unknown): string {
  if (typeof modelId === "string" && modelId.trim()) {
    return modelId.trim();
  }
  return DEFAULT_MODEL_ID;
}

/**
 * Extracts the plain-text content from a UIMessage's text parts.
 */
function getMessageText(message: UIMessage): string {
  return (
    message.parts
      ?.filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join(" ")
      .trim() ?? ""
  );
}

/**
 * Generates a short title (≤ {@link TITLE_MAX_CHARS} characters) for a conversation
 * based on the first user message. Returns `null` on failure so callers can fall back gracefully.
 */
async function generateConversationTitle({
  firstUserMessage,
  gatewayProviderOptions,
}: {
  firstUserMessage: UIMessage;
  gatewayProviderOptions: Record<string, unknown> | undefined;
}): Promise<string | null> {
  const messageText = getMessageText(firstUserMessage);
  if (!messageText) return null;

  try {
    const { text } = await generateText({
      model: gateway.languageModel(TITLE_MODEL_ID),
      prompt: `Generate a short, descriptive title (maximum ${TITLE_MAX_CHARS} characters) for a chat conversation that starts with this message. Return ONLY the title text, with no surrounding quotes or trailing punctuation:\n\n"${messageText.slice(0, 500)}"`,
      providerOptions: gatewayProviderOptions,
    });
    const title = text.trim().slice(0, TITLE_MAX_CHARS);
    return title || null;
  } catch {
    // Title generation is non-critical — fall through so the main response still streams.
    return null;
  }
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

  // Detect first turn: exactly one user message means we can generate a meaningful title.
  const userMessages = uiMessages.filter((m) => m.role === "user");
  const isFirstTurn = userMessages.length === 1;

  // Run title generation and the main chat turn concurrently to minimise TTFB.
  const [generatedTitle, result] = await Promise.all([
    isFirstTurn
      ? generateConversationTitle({
          firstUserMessage: userMessages[0],
          gatewayProviderOptions,
        })
      : Promise.resolve(null),
    runAssistantChatTurn({
      supabase,
      userId: user.id,
      uiMessages,
      modelId,
      conversationId,
      gatewayProviderOptions,
    }),
  ]);

  // If a title was generated, prepend it as a data chunk before the main message stream
  // so the client can update the header immediately without waiting for the full response.
  if (generatedTitle) {
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({
          type: "data-conversation-title",
          data: { title: generatedTitle },
        });
        writer.merge(result.toUIMessageStream());
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  return result.toUIMessageStreamResponse();
}
