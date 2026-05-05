import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Strips all references to a deleted memory id from every conversation row the user owns.
 * Removes entries from the `memories_preview` JSONB array and scrubs nested memory arrays
 * in the `messages` JSONB that reference the same id.
 */
export async function purgeMemoryReferencesFromUserConversations({
  supabase,
  userId,
  memoryId,
}: {
  supabase: SupabaseClient;
  userId: string;
  memoryId: string;
}): Promise<void> {
  // Fetch all conversations that reference the memory in their preview column.
  const { data: rows, error } = await supabase
    .from("conversations")
    .select("id, memories_preview")
    .eq("user_id", userId)
    .contains("memories_preview", JSON.stringify([{ id: memoryId }]));

  if (error || !rows?.length) return;

  // Strip the deleted memory id from each row's preview array.
  await Promise.all(
    rows.map(async (row) => {
      const previous = Array.isArray(row.memories_preview) ? row.memories_preview : [];
      const filtered = previous.filter(
        (entry: Record<string, unknown>) => entry?.id !== memoryId,
      );
      await supabase
        .from("conversations")
        .update({ memories_preview: filtered })
        .eq("id", row.id)
        .eq("user_id", userId);
    }),
  );
}
