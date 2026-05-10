import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mergeSidebarMemoryPreviewRows,
  memoryRetrievedRowsToSidebarPreviewItems,
  parseSidebarPreviewPayload,
  type SidebarMemoryPreviewItem,
} from "@/lib/conversations/sidebar-memory-preview";
import {
  archiveMemory,
  deleteMemory,
  saveMemory,
  updateMemory,
} from "@/lib/memories/memory-service";
import { purgeMemoryReferencesFromUserConversations } from "@/lib/memories/purge-memory-references-from-conversations";
import type { MemoryRecord, MemoryReviewAction, MemoryType } from "@/lib/memories/types";
import { validateMemoryActions } from "@/lib/memories/validate-memory-actions";

/**
 * Applies structured memory review actions to Postgres after validation and safety checks.
 */
export async function applyMemoryReviewActions({
  supabase,
  userId,
  userMessageText,
  actions,
  conversationId,
}: {
  supabase: SupabaseClient;
  userId: string;
  userMessageText: string;
  actions: MemoryReviewAction[];
  conversationId: string | null;
}): Promise<{
  memoriesNewlyCreated: Array<{ id: string; type: string; key: string; preview: string }>;
  appliedActionKinds: MemoryReviewAction["action"][];
}> {
  const { data: activeRows, error: activeError } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(400);

  if (activeError) {
    throw new Error(`Unable to load active memories: ${activeError.message}`);
  }

  const activeMemories = (activeRows ?? []) as MemoryRecord[];
  const { validated } = validateMemoryActions({
    actions,
    userMessageText,
    activeMemories,
  });

  const memoriesNewlyCreated: Array<{
    id: string;
    type: string;
    key: string;
    preview: string;
  }> = [];
  const appliedActionKinds: MemoryReviewAction["action"][] = [];

  const metaBase = {
    ...(conversationId ? { source_conversation_id: conversationId } : {}),
    memory_review_at: new Date().toISOString(),
  };

  for (const action of validated) {
    if (action.action === "NOOP") {
      continue;
    }

    if (action.action === "SAVE") {
      const type = action.type as MemoryType;
      const keySource = action.key ?? action.content ?? "";
      const row = await saveMemory({
        supabase,
        userId,
        type,
        key: keySource,
        content: action.content ?? "",
        importance: action.importance,
        confidence: action.confidence,
        source: "memory_review",
        sourceMessageId: null,
        expiresAt: action.expiresAt,
        metadata: { ...metaBase, review_reason: action.reason },
        conversationId,
      });
      memoriesNewlyCreated.push({
        id: row.id,
        type: row.type,
        key: row.key,
        preview: row.content,
      });
      appliedActionKinds.push("SAVE");
      continue;
    }

    if (action.action === "UPDATE") {
      if (!action.memoryId || !action.content?.trim()) continue;
      await updateMemory({
        supabase,
        userId,
        memoryId: action.memoryId,
        content: action.content.trim(),
        importance: action.importance,
        confidence: action.confidence,
        reason: action.reason,
        conversationId,
      });
      appliedActionKinds.push("UPDATE");
      continue;
    }

    if (action.action === "ARCHIVE") {
      if (!action.memoryId) continue;
      await archiveMemory({
        supabase,
        userId,
        memoryId: action.memoryId,
        reason: action.reason,
      });
      appliedActionKinds.push("ARCHIVE");
      continue;
    }

    if (action.action === "DELETE") {
      if (!action.memoryId) continue;
      await deleteMemory({
        supabase,
        userId,
        memoryId: action.memoryId,
        reason: action.reason,
        permanent: true,
      });
      await purgeMemoryReferencesFromUserConversations({
        supabase,
        userId,
        memoryId: action.memoryId,
      }).catch(() => {});
      appliedActionKinds.push("DELETE");
    }
  }

  if (conversationId && memoriesNewlyCreated.length > 0) {
    const newItems = memoryRetrievedRowsToSidebarPreviewItems({
      rows: memoriesNewlyCreated,
    }).map((item) => ({ ...item, isNew: true as const }));
    await mergeNewMemoriesIntoConversationPreview({
      supabase,
      userId,
      conversationId,
      newItems,
    });
  }

  return { memoriesNewlyCreated, appliedActionKinds };
}

/**
 * Merges newly created memory chips into the conversation row so the sidebar stays fresh after `after()`.
 */
async function mergeNewMemoriesIntoConversationPreview({
  supabase,
  userId,
  conversationId,
  newItems,
}: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  newItems: SidebarMemoryPreviewItem[];
}): Promise<void> {
  if (newItems.length === 0) return;

  const { data: row, error } = await supabase
    .from("conversations")
    .select("memories_preview")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !row) return;

  const existing = parseSidebarPreviewPayload(row.memories_preview ?? []);
  const merged = mergeSidebarMemoryPreviewRows(existing, newItems.map((i) => ({ ...i, isNew: true })));

  await supabase
    .from("conversations")
    .update({ memories_preview: merged })
    .eq("id", conversationId)
    .eq("user_id", userId);
}
