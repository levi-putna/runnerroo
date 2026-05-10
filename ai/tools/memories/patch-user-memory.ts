import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";

import { archiveMemory, updateMemory } from "@/lib/memories/memory-service";
import { recordAssistantMemoryTurnEvent } from "@/lib/memories/record-assistant-memory-turn-event";

/**
 * Builds a tool that updates an existing memory’s text/scores or archives it.
 */
export function createPatchUserMemoryTool({
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
      "Update the text or scores of an existing memory, or archive it when it is superseded. Requires the memory UUID.",
    inputSchema: z.object({
      memoryId: z.string().min(1).describe("Target memory id."),
      content: z.string().describe("Replacement memory text."),
      importance: z.number().min(0).max(1).optional(),
      confidence: z.number().min(0).max(1).optional(),
      archive: z
        .boolean()
        .optional()
        .describe("When true, archives the row instead of updating content."),
      reason: z.string().describe("Short reason for the audit trail."),
    }),
    execute: async ({ memoryId, content, importance, confidence, archive, reason }) => {
      if (archive) {
        const row = await archiveMemory({
          supabase,
          userId,
          memoryId,
          reason,
        });
        void recordAssistantMemoryTurnEvent({
          supabase,
          userId,
          conversationId: conversationId ?? null,
          kind: "tool_write",
          payload: { tool: "patchUserMemory", action: "archive", memoryId },
        }).catch(() => {});
        return { id: row.id, status: row.status };
      }

      const row = await updateMemory({
        supabase,
        userId,
        memoryId,
        content,
        importance: importance ?? 0.75,
        confidence: confidence ?? 0.85,
        reason,
        ...(conversationId !== undefined ? { conversationId } : {}),
      });

      void recordAssistantMemoryTurnEvent({
        supabase,
        userId,
        conversationId: conversationId ?? null,
        kind: "tool_write",
        payload: { tool: "patchUserMemory", action: "update", memoryId: row.id },
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
