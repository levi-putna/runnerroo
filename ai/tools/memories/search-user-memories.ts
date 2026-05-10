import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";

import { searchMemory } from "@/lib/memories/memory-service";
import { recordAssistantMemoryTurnEvent } from "@/lib/memories/record-assistant-memory-turn-event";
import { MEMORY_TYPES } from "@/lib/memories/types";

/**
 * Builds a tool for searching the authenticated user's memory store.
 */
export function createSearchUserMemoriesTool({
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
      "Search saved long-term user memories by semantic meaning and keywords. Use when you need a specific user preference, project context, or prior decision.",
    inputSchema: z.object({
      query: z.string().describe("What memory to search for."),
      types: z
        .array(z.enum(MEMORY_TYPES))
        .optional()
        .describe("Optional memory type filter."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Maximum memories to return."),
    }),
    execute: async ({ query, types, limit }) => {
      const memories = await searchMemory({
        supabase,
        userId,
        query,
        types,
        limit: limit ?? 5,
        ...(conversationId !== undefined ? { conversationId } : {}),
      });

      const payload = {
        memories: memories.map((memory) => ({
          id: memory.id,
          type: memory.type,
          key: memory.key,
          content: memory.content,
          combinedScore: memory.combined_score,
        })),
      };

      void recordAssistantMemoryTurnEvent({
        supabase,
        userId,
        conversationId: conversationId ?? null,
        kind: "tool_write",
        payload: { tool: "searchUserMemories", query: query.slice(0, 500) },
      }).catch(() => {});

      return payload;
    },
  });
}
