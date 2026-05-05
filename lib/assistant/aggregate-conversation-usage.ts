import type { LanguageModelUsage, UIMessage } from "ai";

import type { ModelUsageSlice, AssistantMessageMetadata } from "@/lib/assistant/chat-usage-metadata";

export type ConversationUsageAggregate = {
  totalTokens: number;
  totalEstimatedUsd: number | null;
  byModel: Array<{
    modelId: string;
    usage: LanguageModelUsage;
    estimatedUsd: number | null;
    phases: Array<ModelUsageSlice["phase"]>;
  }>;
};

function mergeLanguageModelUsage(previous: LanguageModelUsage, next: LanguageModelUsage): LanguageModelUsage {
  const add = (a: number | undefined, b: number | undefined): number | undefined => {
    const sum = (a ?? 0) + (b ?? 0);
    return sum === 0 ? undefined : sum;
  };

  return {
    inputTokens: add(previous.inputTokens, next.inputTokens),
    inputTokenDetails: {
      noCacheTokens: add(previous.inputTokenDetails?.noCacheTokens, next.inputTokenDetails?.noCacheTokens),
      cacheReadTokens: add(previous.inputTokenDetails?.cacheReadTokens, next.inputTokenDetails?.cacheReadTokens),
      cacheWriteTokens: add(previous.inputTokenDetails?.cacheWriteTokens, next.inputTokenDetails?.cacheWriteTokens),
    },
    outputTokens: add(previous.outputTokens, next.outputTokens),
    outputTokenDetails: {
      textTokens: add(previous.outputTokenDetails?.textTokens, next.outputTokenDetails?.textTokens),
      reasoningTokens: add(previous.outputTokenDetails?.reasoningTokens, next.outputTokenDetails?.reasoningTokens),
    },
    totalTokens: add(previous.totalTokens, next.totalTokens),
  };
}

function tokenTotal(usage: LanguageModelUsage): number {
  if (typeof usage.totalTokens === "number" && usage.totalTokens > 0) return usage.totalTokens;
  return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}

export function aggregateConversationUsageFromMessages(messages: UIMessage[]): ConversationUsageAggregate {
  const byModel = new Map<string, { usage: LanguageModelUsage; estimatedUsd: number | null; phases: Set<ModelUsageSlice["phase"]> }>();

  let totalEstimatedUsd = 0;
  let hasAnyEstimate = false;
  let totalTokens = 0;

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const metadata = message.metadata as AssistantMessageMetadata | undefined;
    if (!metadata?.usageSlices?.length) continue;

    for (const slice of metadata.usageSlices) {
      totalTokens += tokenTotal(slice.usage);

      if (slice.estimatedCostUsd != null) {
        hasAnyEstimate = true;
        totalEstimatedUsd += slice.estimatedCostUsd;
      }

      const existing = byModel.get(slice.modelId);
      if (!existing) {
        byModel.set(slice.modelId, { usage: slice.usage, estimatedUsd: slice.estimatedCostUsd, phases: new Set([slice.phase]) });
      } else {
        const a = existing.estimatedUsd;
        const b = slice.estimatedCostUsd;
        byModel.set(slice.modelId, {
          usage: mergeLanguageModelUsage(existing.usage, slice.usage),
          estimatedUsd: a == null && b == null ? null : (a ?? 0) + (b ?? 0),
          phases: new Set([...existing.phases, slice.phase]),
        });
      }
    }
  }

  const rows = [...byModel.entries()].map(([modelId, row]) => ({
    modelId,
    usage: row.usage,
    estimatedUsd: row.estimatedUsd,
    phases: [...row.phases],
  }));

  return { totalTokens, totalEstimatedUsd: hasAnyEstimate ? totalEstimatedUsd : null, byModel: rows };
}
