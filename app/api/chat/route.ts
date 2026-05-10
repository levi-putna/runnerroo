/**
 * Chat API — thin HTTP boundary for the assistant.
 *
 * Pipeline:
 * 1. Authenticate the Supabase user.
 * 2. Parse JSON body (`messages`, `modelId`, `conversationId`).
 * 3. Run hybrid memory retrieval once, then emit `data-assistant-memory-context` when wrapping the stream.
 * 4. On the first turn, generate a short conversation title via a fast model and stream it as
 *    a `data-conversation-title` chunk so the UI can display it immediately.
 * 5. Delegate to {@link runAssistantChatTurn} (optional planning, tools, `streamText`) with the precomputed memory turn.
 * 6. Return a UI message stream for {@link @ai-sdk/react.useChat}.
 */

import {
  generateText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageStreamOnFinishCallback,
} from "ai";
import { gateway } from "@ai-sdk/gateway";
import { after } from "next/server";

import { isAssistantPingShortcutMessage, runAssistantChatTurn } from "@/ai/agents/chat-agent";
import { runMemoryReviewAgent } from "@/ai/agents/memory-review-agent";
import {
  runAssistantMemoryRetrieval,
  type RunAssistantMemoryRetrievalResult,
} from "@/ai/agents/memory-retrieval-agent";
import { applyMemoryReviewActions } from "@/lib/memories/apply-memory-review-actions";
import { recordAssistantMemoryTurnEvent } from "@/lib/memories/record-assistant-memory-turn-event";
import {
  buildRunnerGatewayProviderOptions,
  GATEWAY_USAGE_TAG_MEMORY_REVIEW,
  gatewayUsageTagsForConversation,
} from "@/lib/ai-gateway/runner-gateway-tracking";
import { DEFAULT_MODEL_ID } from "@/lib/ai-gateway/models";
import { memoryRetrievedRowsToSidebarPreviewItems } from "@/lib/conversations/sidebar-memory-preview";
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

/**
 * Builds the HTTP response, optionally prepending UI data chunks before the merged model stream.
 */
function createAssistantChatStreamResponse({
  memoryContextData,
  generatedTitle,
  streamResult,
  messageMetadata,
  onFinish,
}: {
  memoryContextData: { items: ReturnType<typeof memoryRetrievedRowsToSidebarPreviewItems> } | null;
  generatedTitle: string | null;
  streamResult: Awaited<ReturnType<typeof runAssistantChatTurn>>["streamResult"];
  messageMetadata: Awaited<ReturnType<typeof runAssistantChatTurn>>["messageMetadata"];
  onFinish?: UIMessageStreamOnFinishCallback<UIMessage>;
}): Response {
  const shouldWrap = Boolean(generatedTitle) || Boolean(memoryContextData?.items.length);

  const streamOptions = {
    messageMetadata,
    ...(onFinish ? { onFinish } : {}),
  };

  if (!shouldWrap) {
    return streamResult.toUIMessageStreamResponse(streamOptions);
  }

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      if (memoryContextData && memoryContextData.items.length > 0) {
        writer.write({
          type: "data-assistant-memory-context",
          data: { items: memoryContextData.items },
        });
      }
      if (generatedTitle) {
        writer.write({
          type: "data-conversation-title",
          data: { title: generatedTitle },
        });
      }
      writer.merge(streamResult.toUIMessageStream(streamOptions));
    },
  });

  return createUIMessageStreamResponse({ stream });
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

  const lastUserMessage = [...uiMessages].reverse().find((m) => m.role === "user");
  const latestUserText = lastUserMessage ? getMessageText(lastUserMessage) : "";
  const skipShortcutPath = isAssistantPingShortcutMessage({ queryText: latestUserText });

  const emptyMemoryTurn: RunAssistantMemoryRetrievalResult = {
    retrievedMemories: [],
    memoryFactsBlock: "",
    memoriesRetrieved: [],
  };

  const memoryTurn = skipShortcutPath
    ? emptyMemoryTurn
    : await runAssistantMemoryRetrieval({
        supabase,
        userId: user.id,
        uiMessages,
        conversationId,
        limit: 8,
        gatewayProviderOptions,
      });

  const memoryContextData =
    memoryTurn.memoriesRetrieved.length > 0
      ? {
          items: memoryRetrievedRowsToSidebarPreviewItems({
            rows: memoryTurn.memoriesRetrieved,
          }),
        }
      : null;

  void recordAssistantMemoryTurnEvent({
    supabase,
    userId: user.id,
    conversationId,
    kind: "retrieval",
    payload: {
      retrievedIds: memoryTurn.memoriesRetrieved.map((m) => m.id),
    },
  }).catch(() => {});

  // Detect first turn: exactly one user message means we can generate a meaningful title.
  const userMessages = uiMessages.filter((m) => m.role === "user");
  const isFirstTurn = userMessages.length === 1;
  /** `ping` mock path skips real LLM entirely — do not call the title model for that turn. */
  const skipTitleForPingMock =
    isFirstTurn &&
    isAssistantPingShortcutMessage({ queryText: getMessageText(userMessages[0]) });

  // Run title generation and the main chat turn concurrently to minimise TTFB.
  const [generatedTitle, chatTurn] = await Promise.all([
    isFirstTurn && !skipTitleForPingMock
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
      memoryTurn,
    }),
  ]);

  const { streamResult, messageMetadata } = chatTurn;

  const reviewProviderOptions = buildRunnerGatewayProviderOptions({
    supabaseUserId: user.id,
    tags: [...gatewayUsageTagsForConversation({ conversationId }), GATEWAY_USAGE_TAG_MEMORY_REVIEW],
  });

  const onFinish: UIMessageStreamOnFinishCallback<UIMessage> | undefined = skipShortcutPath
    ? undefined
    : async ({ responseMessage, isAborted }) => {
    if (isAborted) return;
    if (process.env.RUNNER_ASSISTANT_MEMORY_REVIEW === "false") return;

    const assistantResponseText = getMessageText(responseMessage);

    after(async () => {
      try {
        const { actions } = await runMemoryReviewAgent({
          userMessageText: latestUserText,
          assistantResponseText,
          retrievedMemories: memoryTurn.memoriesRetrieved,
          providerOptions: reviewProviderOptions,
        });

        const applied = await applyMemoryReviewActions({
          supabase,
          userId: user.id,
          userMessageText: latestUserText,
          actions,
          conversationId,
        });

        await recordAssistantMemoryTurnEvent({
          supabase,
          userId: user.id,
          conversationId,
          kind: "review",
          payload: {
            actionKinds: applied.appliedActionKinds,
            createdIds: applied.memoriesNewlyCreated.map((m) => m.id),
            retrievedIds: memoryTurn.memoriesRetrieved.map((m) => m.id),
          },
        }).catch(() => {});
      } catch (error) {
        console.error("assistant memory review failed", error);
      }
    });
  };

  return createAssistantChatStreamResponse({
    memoryContextData,
    generatedTitle,
    streamResult,
    messageMetadata,
    onFinish,
  });
}
