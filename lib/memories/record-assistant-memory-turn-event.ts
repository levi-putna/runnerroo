import type { SupabaseClient } from "@supabase/supabase-js";

export type AssistantMemoryTurnEventKind = "retrieval" | "review" | "tool_write";

/**
 * Persists a single assistant memory lifecycle event for analytics and debugging.
 */
export async function recordAssistantMemoryTurnEvent({
  supabase,
  userId,
  conversationId,
  kind,
  payload,
}: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string | null;
  kind: AssistantMemoryTurnEventKind;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("assistant_memory_turn_events").insert({
    user_id: userId,
    conversation_id: conversationId,
    kind,
    payload,
  });

  if (error) {
    throw new Error(`Unable to record memory turn event: ${error.message}`);
  }
}
