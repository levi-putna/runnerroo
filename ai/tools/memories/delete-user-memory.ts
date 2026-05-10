import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";

import { deleteMemory } from "@/lib/memories/memory-service";
import { purgeMemoryReferencesFromUserConversations } from "@/lib/memories/purge-memory-references-from-conversations";
import { recordAssistantMemoryTurnEvent } from "@/lib/memories/record-assistant-memory-turn-event";

/**
 * Builds a tool that permanently removes a memory the user asked to forget.
 */
export function createDeleteUserMemoryTool({
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
      "Permanently delete a saved user memory when they explicitly want it removed. This cannot be undone.",
    inputSchema: z.object({
      memoryId: z.string().min(1).describe("Memory id to delete."),
      reason: z.string().describe("Short reason (e.g. user requested forget)."),
    }),
    execute: async ({ memoryId, reason }) => {
      await deleteMemory({
        supabase,
        userId,
        memoryId,
        reason,
        permanent: true,
      });

      await purgeMemoryReferencesFromUserConversations({
        supabase,
        userId,
        memoryId,
      }).catch(() => {});

      void recordAssistantMemoryTurnEvent({
        supabase,
        userId,
        conversationId: conversationId ?? null,
        kind: "tool_write",
        payload: { tool: "deleteUserMemory", memoryId },
      }).catch(() => {});

      return { ok: true as const, memoryId };
    },
  });
}
