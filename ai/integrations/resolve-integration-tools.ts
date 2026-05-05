import type { Tool } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { McpIntegrationsBrief } from "@/ai/integrations/types";

/**
 * Future hook: merge MCP or OAuth-backed tools when integrations ship.
 * Today this returns an empty set so {@link import('@/ai/tools/index').createAssistantTools} stays stable.
 */
export async function resolveIntegrationToolsForUser({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<{
  tools: Record<string, Tool>;
  brief: McpIntegrationsBrief;
}> {
  void supabase;
  void userId;
  return {
    tools: {},
    brief: { summaryLines: [] },
  };
}
