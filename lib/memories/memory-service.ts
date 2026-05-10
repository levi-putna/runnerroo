import type { SupabaseClient } from "@supabase/supabase-js";

import { createMemoryEmbedding } from "@/lib/embeddings/create-memory-embedding";
import { toMemoryKeySlug } from "@/lib/memories/validate-memory-actions";
import type { MemoryHybridMatch, MemoryRecord, MemoryType } from "@/lib/memories/types";

async function getMemoryById({
  supabase,
  userId,
  memoryId,
}: {
  supabase: SupabaseClient;
  userId: string;
  memoryId: string;
}): Promise<MemoryRecord> {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("id", memoryId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Memory not found for this user.");
  }

  return data as MemoryRecord;
}

function mergeMetadata({
  previous,
  next,
}: {
  previous: Record<string, unknown> | null | undefined;
  next: Record<string, unknown>;
}): Record<string, unknown> {
  return { ...(previous ?? {}), ...next };
}

export async function saveMemory({
  supabase,
  userId,
  type,
  key,
  content,
  importance,
  confidence,
  source,
  sourceMessageId,
  expiresAt,
  metadata,
  conversationId,
}: {
  supabase: SupabaseClient;
  userId: string;
  type: MemoryType;
  key: string;
  content: string;
  importance: number;
  confidence: number;
  source: string | null;
  sourceMessageId: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  conversationId?: string | null;
}): Promise<MemoryRecord> {
  const stableKey = toMemoryKeySlug({ value: key });
  const embedding = await createMemoryEmbedding({
    text: `${stableKey}\n${content.trim()}`,
    supabaseUserId: userId,
    embeddingPurpose: "memory_write",
    ...(conversationId !== undefined ? { conversationId } : {}),
  });

  const { data: existing, error: existingError } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .eq("key", stableKey)
    .eq("status", "active")
    .maybeSingle();

  if (existingError) {
    throw new Error(`Unable to check existing memory: ${existingError.message}`);
  }

  if (existing) {
    const { data, error } = await supabase
      .from("memories")
      .update({
        type,
        content: content.trim(),
        importance,
        confidence,
        source,
        source_message_id: sourceMessageId,
        expires_at: expiresAt,
        metadata: mergeMetadata({
          previous: existing.metadata as Record<string, unknown> | undefined,
          next: metadata,
        }),
        embedding,
      })
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Unable to update memory: ${error?.message ?? "Unknown error"}`);
    }

    return data as MemoryRecord;
  }

  const { data, error } = await supabase
    .from("memories")
    .insert({
      user_id: userId,
      type,
      key: stableKey,
      content: content.trim(),
      importance,
      confidence,
      source,
      source_message_id: sourceMessageId,
      expires_at: expiresAt,
      metadata,
      status: "active",
      embedding,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Unable to save memory: ${error?.message ?? "Unknown error"}`);
  }

  return data as MemoryRecord;
}

export async function searchMemory({
  supabase,
  userId,
  query,
  embeddingSourceText,
  types,
  limit,
  conversationId,
}: {
  supabase: SupabaseClient;
  userId: string;
  query: string;
  /** Richer text for the vector leg only; `query` stays the keyword leg when omitted. */
  embeddingSourceText?: string | null;
  types?: MemoryType[];
  limit?: number;
  /** Thread id for embedding gateway tags (hybrid RPC unchanged). */
  conversationId?: string | null;
}): Promise<MemoryHybridMatch[]> {
  const queryText = query.trim();
  if (!queryText) return [];

  const embedText = (embeddingSourceText ?? queryText).trim();
  if (!embedText) return [];

  const queryEmbedding = await createMemoryEmbedding({
    text: embedText,
    supabaseUserId: userId,
    embeddingPurpose: "memory_query",
    ...(conversationId !== undefined ? { conversationId } : {}),
  });
  const { data, error } = await supabase.rpc("match_memories_hybrid", {
    query_text: queryText,
    query_embedding: queryEmbedding,
    match_count: limit ?? 10,
    filter_types: types && types.length > 0 ? types : null,
  });

  if (error) {
    throw new Error(`Unable to search memories: ${error.message}`);
  }

  const results = (data ?? []) as MemoryHybridMatch[];
  if (results.length === 0) return [];

  const now = new Date().toISOString();
  await Promise.all(
    results.map(async (memory) => {
      await supabase
        .from("memories")
        .update({ usage_count: memory.usage_count + 1, last_used_at: now })
        .eq("id", memory.id)
        .eq("user_id", userId);
    }),
  );

  return results;
}

export async function updateMemory({
  supabase,
  userId,
  memoryId,
  content,
  importance,
  confidence,
  reason,
  conversationId,
}: {
  supabase: SupabaseClient;
  userId: string;
  memoryId: string;
  content: string;
  importance: number;
  confidence: number;
  reason: string;
  conversationId?: string | null;
}): Promise<MemoryRecord> {
  const existing = await getMemoryById({ supabase, userId, memoryId });
  const embedding = await createMemoryEmbedding({
    text: `${existing.key}\n${content.trim()}`,
    supabaseUserId: userId,
    embeddingPurpose: "memory_write",
    ...(conversationId !== undefined ? { conversationId } : {}),
  });

  const { data, error } = await supabase
    .from("memories")
    .update({
      content: content.trim(),
      importance,
      confidence,
      embedding,
      metadata: mergeMetadata({ previous: existing.metadata, next: { reason } }),
    })
    .eq("id", memoryId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Unable to update memory: ${error?.message ?? "Unknown error"}`);
  }

  return data as MemoryRecord;
}

export async function archiveMemory({
  supabase,
  userId,
  memoryId,
  reason,
}: {
  supabase: SupabaseClient;
  userId: string;
  memoryId: string;
  reason: string;
}): Promise<MemoryRecord> {
  const existing = await getMemoryById({ supabase, userId, memoryId });
  const { data, error } = await supabase
    .from("memories")
    .update({
      status: "archived",
      metadata: mergeMetadata({ previous: existing.metadata, next: { reason } }),
    })
    .eq("id", memoryId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Unable to archive memory: ${error?.message ?? "Unknown error"}`);
  }

  return data as MemoryRecord;
}

export async function deleteMemory({
  supabase,
  userId,
  memoryId,
  reason,
  permanent = false,
}: {
  supabase: SupabaseClient;
  userId: string;
  memoryId: string;
  reason: string;
  permanent?: boolean;
}): Promise<void> {
  const existing = await getMemoryById({ supabase, userId, memoryId });

  if (permanent) {
    const { error } = await supabase
      .from("memories")
      .delete()
      .eq("id", memoryId)
      .eq("user_id", userId);

    if (error) throw new Error(`Unable to permanently delete memory: ${error.message}`);
    return;
  }

  const { error } = await supabase
    .from("memories")
    .update({
      status: "deleted",
      metadata: mergeMetadata({ previous: existing.metadata, next: { reason } }),
    })
    .eq("id", memoryId)
    .eq("user_id", userId);

  if (error) throw new Error(`Unable to soft-delete memory: ${error.message}`);
}
