import type { ProviderOptions } from "@ai-sdk/provider-utils";
import { gateway } from "@ai-sdk/gateway";
import { generateObject } from "ai";
import { z } from "zod";

import { MEMORY_TYPES, type MemoryReviewAction } from "@/lib/memories/types";

const MEMORY_REVIEW_MODEL =
  process.env.MEMORY_REVIEW_MODEL ??
  process.env.NEXT_PUBLIC_ASSISTANT_MODEL ??
  "google/gemini-3-flash";

const memoryReviewActionSchema = z.object({
  action: z.enum(["SAVE", "UPDATE", "ARCHIVE", "DELETE", "NOOP"]),
  memoryId: z.string().nullable(),
  type: z.enum(MEMORY_TYPES).nullable(),
  key: z.string().nullable(),
  content: z.string().nullable(),
  importance: z.number(),
  confidence: z.number(),
  expiresAt: z.string().nullable(),
  reason: z.string(),
});

const memoryReviewResponseSchema = z.object({
  actions: z.array(memoryReviewActionSchema),
});

const MEMORY_REVIEW_SYSTEM_PROMPT = `You are a memory management agent for an assistant-style AI application.

Your job is to review the latest conversation and decide whether any long-term memory should be created, updated, archived, or deleted.

Only store information that is likely to improve future conversations.

Save:
- explicit user preferences
- stable user facts
- long-term projects
- technical stack choices
- repeated working patterns
- important decisions
- corrections to previous memories

Do not save:
- casual small talk
- one-off requests
- temporary information unless it needs an expiry
- sensitive personal information unless the user explicitly asked to remember it
- passwords, tokens, secrets, or private credentials
- facts copied from documents the user is editing
- weak guesses or uncertain inferences

Rules:
1. Prefer UPDATE over SAVE when the new information relates to an existing memory.
2. Do not create duplicate memories.
3. Use DELETE only when the user explicitly asks to forget something or when a memory is clearly invalid.
4. Use ARCHIVE for stale or superseded memories.
5. Use temporary type and an expiresAt value for short-lived context.
6. Assign confidence based on how directly the user stated the information.
7. Assign importance based on likely future usefulness.
8. Store concise reusable facts, not raw conversation text.
9. Return JSON only.`;

/**
 * Runs a strict memory review pass after the assistant response is generated.
 */
export async function runMemoryReviewAgent({
  userMessageText,
  assistantResponseText,
  retrievedMemories,
  conversationSummary,
  providerOptions,
}: {
  userMessageText: string;
  assistantResponseText: string;
  retrievedMemories: Array<{
    id: string;
    type: string;
    key: string;
    /** Plain memory body; callers may pass `preview` from hybrid search instead. */
    content?: string;
    preview?: string;
  }>;
  conversationSummary?: string;
  providerOptions?: ProviderOptions;
}): Promise<{ actions: MemoryReviewAction[] }> {
  const prompt = [
    `Latest user message:\n${userMessageText || "(empty)"}`,
    `Assistant response:\n${assistantResponseText || "(empty)"}`,
    `Retrieved memories:\n${JSON.stringify(
      retrievedMemories.map((m) => ({
        ...m,
        content: m.content ?? m.preview ?? "",
      })),
    )}`,
    conversationSummary ? `Recent conversation summary:\n${conversationSummary}` : null,
    `Return shape:
{
  "actions": [
    {
      "action": "SAVE" | "UPDATE" | "ARCHIVE" | "DELETE" | "NOOP",
      "memoryId": null,
      "type": "preference" | "profile" | "project" | "task" | "temporary" | "behaviour" | "technical_context" | null,
      "key": null,
      "content": null,
      "importance": 0,
      "confidence": 0,
      "expiresAt": null,
      "reason": ""
    }
  ]
}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { object } = await generateObject({
    model: gateway.languageModel(MEMORY_REVIEW_MODEL),
    system: MEMORY_REVIEW_SYSTEM_PROMPT,
    prompt,
    ...(providerOptions ? { providerOptions } : {}),
    schema: memoryReviewResponseSchema,
  });

  return object;
}
