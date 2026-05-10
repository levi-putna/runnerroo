import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";

import { saveMemory } from "@/lib/memories/memory-service";
import { recordAssistantMemoryTurnEvent } from "@/lib/memories/record-assistant-memory-turn-event";
import { MEMORY_TYPES } from "@/lib/memories/types";

/**
 * Builds a tool that creates or refreshes a user memory row (idempotent by slugged key).
 */
export function createUpsertUserMemoryTool({
  supabase,
  userId,
  conversationId,
}: {
  supabase: SupabaseClient;
  userId: string;
  conversationId?: string | null;
}) {
  return tool({
    description:
      "Save or update a long-term user memory when the user explicitly asks to remember something, or when a durable preference or fact should persist. Prefer concise, reusable statements.",
    inputSchema: z.object({
      type: z.enum(MEMORY_TYPES).describe("Memory category."),
      key: z
        .string()
        .describe("Short human label used to deduplicate (e.g. preferred_editor, home_city)."),
      content: z.string().describe("The factual sentence to store."),
      importance: z.number().min(0).max(1).optional().describe("0–1 future usefulness."),
      confidence: z.number().min(0).max(1).optional().describe("0–1 how certain this is."),
      expiresAt: z.string().nullable().optional().describe("ISO timestamp for temporary memories."),
    }),
    execute: async ({ type, key, content, importance, confidence, expiresAt }) => {
      const row = await saveMemory({
        supabase,
        userId,
        type,
        key,
        content,
        importance: importance ?? 0.75,
        confidence: confidence ?? 0.85,
        source: "assistant_tool_upsert",
        sourceMessageId: null,
        expiresAt: expiresAt ?? null,
        metadata: { tool: "upsertUserMemory" },
        ...(conversationId !== undefined ? { conversationId } : {}),
      });

      void recordAssistantMemoryTurnEvent({
        supabase,
        userId,
        conversationId: conversationId ?? null,
        kind: "tool_write",
        payload: { tool: "upsertUserMemory", memoryId: row.id },
      }).catch(() => {});

      return {
        id: row.id,
        type: row.type,
        key: row.key,
        content: row.content,
      };
    },
  });
}
