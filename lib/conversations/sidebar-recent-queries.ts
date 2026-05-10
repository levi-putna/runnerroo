import { createClient } from "@/lib/supabase/server"

/** Rolling window for sidebar “Recent” conversations (days). */
const RECENT_SIDEBAR_DAYS = 3

/** Maximum conversations shown in the merged Recent list. */
const RECENT_CONVERSATIONS_LIMIT = 6

export type ConversationSidebarRecentRow = {
  id: string
  title: string | null
  updated_at: string
  created_at: string
}

/**
 * Loads the user’s most recently updated conversations within the rolling window,
 * capped for the app sidebar.
 */
export async function fetchRecentConversationsForSidebar(): Promise<ConversationSidebarRecentRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return []
  }

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - RECENT_SIDEBAR_DAYS)
  const cutoffIso = cutoff.toISOString()

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at, created_at")
    .eq("user_id", user.id)
    .gte("updated_at", cutoffIso)
    .order("updated_at", { ascending: false })
    .limit(RECENT_CONVERSATIONS_LIMIT)

  if (error) {
    console.error("fetchRecentConversationsForSidebar", error.message)
    return []
  }

  return (data ?? []) as ConversationSidebarRecentRow[]
}
