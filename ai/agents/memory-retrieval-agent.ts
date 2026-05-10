import { gateway } from "@ai-sdk/gateway";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import { generateObject, type UIMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { searchMemory } from "@/lib/memories/memory-service";
import type { MemoryHybridMatch } from "@/lib/memories/types";

const RERANK_ENV = "MEMORY_RETRIEVAL_RERANKER";

const RERANK_MODEL =
  process.env.MEMORY_RETRIEVAL_RERANK_MODEL?.trim() ||
  process.env.NEXT_PUBLIC_ASSISTANT_MODEL ||
  "google/gemini-3-flash";

const memoryRerankSchema = z.object({
  selectedMemoryIds: z.array(z.string()),
});

/**
 * Concatenates plain-text parts from a UI message.
 */
function getPlainTextFromMessage({ message }: { message: UIMessage }): string {
  return (
    message.parts
      ?.filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join(" ")
      .trim() ?? ""
  );
}

/**
 * Latest user utterance only — used as the keyword leg for hybrid search.
 */
export function buildMemoryKeywordQueryText({ uiMessages }: { uiMessages: UIMessage[] }): string {
  const lastUser = [...uiMessages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "";
  return getPlainTextFromMessage({ message: lastUser });
}

/**
 * Builds a short rolling transcript for the vector leg (embedding) only.
 */
export function buildMemoryEmbeddingSourceText({
  uiMessages,
  maxMessagesToScan = 8,
  maxTotalChars = 2400,
}: {
  uiMessages: UIMessage[];
  maxMessagesToScan?: number;
  maxTotalChars?: number;
}): string {
  const tail = uiMessages.slice(-maxMessagesToScan);
  const lines: string[] = [];
  let total = 0;
  for (const message of tail) {
    const text = getPlainTextFromMessage({ message });
    if (!text) continue;
    const line = `${message.role}: ${text}`;
    if (total + line.length > maxTotalChars) {
      break;
    }
    lines.push(line);
    total += line.length + 1;
  }
  return lines.join("\n").trim();
}

/**
 * De-duplicates near-identical rows while preserving score order.
 */
function diversifyMemoriesByContentPrefix({
  memories,
  maxItems,
}: {
  memories: MemoryHybridMatch[];
  maxItems: number;
}): MemoryHybridMatch[] {
  const seen = new Set<string>();
  const out: MemoryHybridMatch[] = [];
  for (const memory of memories) {
    const fingerprint = `${memory.type}|${memory.content.trim().toLowerCase().slice(0, 96)}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    out.push(memory);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Optional LLM pass to keep the most relevant memory ids for the system prompt.
 */
async function maybeRerankMemoryMatches({
  userQuery,
  candidates,
  targetCount,
  providerOptions,
}: {
  userQuery: string;
  candidates: MemoryHybridMatch[];
  targetCount: number;
  providerOptions?: ProviderOptions;
}): Promise<MemoryHybridMatch[]> {
  if (process.env[RERANK_ENV] !== "true") {
    return candidates.slice(0, targetCount);
  }
  if (candidates.length <= targetCount) {
    return candidates;
  }

  const catalogue = candidates.map((m) => ({
    id: m.id,
    type: m.type,
    key: m.key,
    content: m.content.slice(0, 400),
  }));

  try {
    const { object } = await generateObject({
      model: gateway.languageModel(RERANK_MODEL),
      system: `You pick which saved user memories are relevant to the latest user request.
Return at most ${targetCount} memory ids in best-first order. Prefer precise matches; omit irrelevant rows.`,
      prompt: `User request (keyword query):\n${userQuery || "(empty)"}\n\nCandidate memories (JSON):\n${JSON.stringify(catalogue)}`,
      ...(providerOptions ? { providerOptions } : {}),
      schema: memoryRerankSchema,
    });

    const idOrder = object.selectedMemoryIds;
    const map = new Map(candidates.map((m) => [m.id, m]));
    const ordered: MemoryHybridMatch[] = [];
    for (const id of idOrder) {
      const row = map.get(id);
      if (row) ordered.push(row);
      if (ordered.length >= targetCount) break;
    }
    if (ordered.length > 0) return ordered;
  } catch {
    // Fall through to score ordering.
  }

  return candidates.slice(0, targetCount);
}

/**
 * Formats retrieved rows as plain bullet lines for {@link buildRunnerAssistantInstructions} (no markdown headings).
 */
export function formatMemoryFactsForSystemPrompt({
  memories,
}: {
  memories: MemoryHybridMatch[];
}): string {
  if (memories.length === 0) return "";
  return memories
    .map((m) => {
      const expiryNote =
        m.type === "temporary" && m.expires_at
          ? ` (expires ${m.expires_at})`
          : "";
      return `- id=${m.id} type=${m.type} key=${m.key}: ${m.content.trim()}${expiryNote}`;
    })
    .join("\n");
}

export type RunAssistantMemoryRetrievalResult = {
  retrievedMemories: MemoryHybridMatch[];
  /** Body text under the "Relevant user memories" system section (bullets only). */
  memoryFactsBlock: string;
  memoriesRetrieved: Array<{ id: string; type: string; key: string; preview: string }>;
};

export type RunAssistantMemoryRetrievalParams = {
  supabase: SupabaseClient;
  userId: string;
  uiMessages: UIMessage[];
  conversationId: string | null;
  /** Max memories to inject into the system prompt and metadata. */
  limit?: number;
  gatewayProviderOptions?: ProviderOptions;
};

/**
 * Hybrid retrieval orchestration before the main assistant model runs: keyword query from the
 * latest user turn, embedding text from a short rolling window, optional diversification and rerank.
 */
export async function runAssistantMemoryRetrieval({
  supabase,
  userId,
  uiMessages,
  conversationId,
  limit = 8,
  gatewayProviderOptions,
}: RunAssistantMemoryRetrievalParams): Promise<RunAssistantMemoryRetrievalResult> {
  const keywordQuery = buildMemoryKeywordQueryText({ uiMessages });
  if (!keywordQuery) {
    return { retrievedMemories: [], memoryFactsBlock: "", memoriesRetrieved: [] };
  }

  const embeddingSource = buildMemoryEmbeddingSourceText({ uiMessages });
  const useExpandedEmbedding =
    embeddingSource.length > keywordQuery.length + 20;

  let rawMatches: MemoryHybridMatch[] = [];
  try {
    rawMatches = await searchMemory({
      supabase,
      userId,
      query: keywordQuery,
      ...(useExpandedEmbedding ? { embeddingSourceText: embeddingSource } : {}),
      conversationId,
      limit: Math.min(24, Math.max(limit * 2, 12)),
    });
  } catch {
    rawMatches = [];
  }

  const diversified = diversifyMemoriesByContentPrefix({
    memories: rawMatches,
    maxItems: Math.min(rawMatches.length, 16),
  });

  const ranked = await maybeRerankMemoryMatches({
    userQuery: keywordQuery,
    candidates: diversified,
    targetCount: limit,
    providerOptions: gatewayProviderOptions,
  });

  const memoryFactsBlock = formatMemoryFactsForSystemPrompt({ memories: ranked });
  const memoriesRetrieved = ranked.map((m) => ({
    id: m.id,
    type: m.type,
    key: m.key,
    preview: m.content,
  }));

  return {
    retrievedMemories: ranked,
    memoryFactsBlock,
    memoriesRetrieved,
  };
}
