import { showDocumentDownload } from "@/ai/tools/documents/show-document-download";
import { generateRandomNumber } from "@/ai/tools/example/generate-random-number";
import { showLocation } from "@/ai/tools/geo-map/show-location";
import { createSearchUserMemoriesTool } from "@/ai/tools/memories/search-user-memories";
import { askQuestion } from "@/ai/tools/utility/ask-question";
import { tavilyCrawl } from "@/ai/tools/utility/tavily-crawl";
import { tavilyExtract } from "@/ai/tools/utility/tavily-extract";
import { webSearch } from "@/ai/tools/utility/web-search";
import { resolveIntegrationToolsForUser } from "@/ai/integrations/resolve-integration-tools";
import { createWorkflowAssistantInvokeTools } from "@/ai/tools/workflows/create-workflow-invoke-tools";
import type { Tool } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { WorkflowAssistantInvokeDescriptor } from "@/lib/workflows/assistant-workflow-invoke-support";

/**
 * Builds the tool map passed to {@link import('ai').streamText} for the Dailify assistant.
 *
 * To add a tool:
 * 1. Implement it under `ai/tools/...` (server `execute` unless it is client-completed).
 * 2. Import and spread it here under a stable camelCase key (that key is the tool name for the model).
 * 3. Register matching UI in {@link import('@/ai/tools/tool-ui-registry').toolUIRegistry | tool-ui-registry.tsx}.
 */
export async function createAssistantTools({
  supabase,
  userId,
  cachedInvokeDescriptors,
}: {
  supabase: SupabaseClient;
  userId: string;
  /** Optional listing reused after planning so invoke workflows are not queried twice in one turn. */
  cachedInvokeDescriptors?: WorkflowAssistantInvokeDescriptor[];
}) {
  const integrations = await resolveIntegrationToolsForUser({ supabase, userId });
  const integrationTools = integrations.tools as Record<string, Tool>;
  const workflowInvoke = await createWorkflowAssistantInvokeTools({
    supabase,
    userId,
    ...(cachedInvokeDescriptors !== undefined ? { descriptors: cachedInvokeDescriptors } : {}),
  });

  return {
    tools: {
      webSearch,
      tavilyExtract,
      tavilyCrawl,
      askQuestion,
      generateRandomNumber,
      showDocumentDownload,
      showLocation,
      searchUserMemories: createSearchUserMemoriesTool({ supabase, userId }),
      ...integrationTools,
      ...workflowInvoke.tools,
    },
    integrationsBrief: integrations.brief,
    workflowsInvokeBrief: workflowInvoke.brief,
  };
}
