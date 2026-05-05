import type { LanguageModelUsage } from "ai";

import type { AssistantMessageMetadata, ModelUsageSlice } from "@/lib/assistant/chat-usage-metadata";
import { estimateCostUsdForUsage } from "@/lib/ai-gateway/estimate-usage-cost";
import type { AiGatewayRawModel } from "@/lib/ai-gateway/gateway-raw-models";

/**
 * Builds assistant-message metadata after the main `streamText` turn finishes, for the Context sidebar usage table.
 */
export function buildRunnerAssistantUsageMetadata({
  planningUsage,
  planningModelId,
  assistantUsage,
  assistantModelId,
  catalogue,
  memoriesRetrieved,
}: {
  planningUsage?: LanguageModelUsage;
  planningModelId: string;
  assistantUsage: LanguageModelUsage;
  assistantModelId: string;
  catalogue: AiGatewayRawModel[];
  memoriesRetrieved?: Array<{
    id: string;
    type: string;
    key: string;
    preview: string;
  }>;
}): AssistantMessageMetadata {
  const slices: ModelUsageSlice[] = [];

  if (planningUsage) {
    slices.push({
      modelId: planningModelId,
      phase: "planning",
      usage: planningUsage,
      estimatedCostUsd: estimateCostUsdForUsage({
        usage: planningUsage,
        modelId: planningModelId,
        catalogue,
      }),
    });
  }

  slices.push({
    modelId: assistantModelId,
    phase: "assistant",
    usage: assistantUsage,
    estimatedCostUsd: estimateCostUsdForUsage({
      usage: assistantUsage,
      modelId: assistantModelId,
      catalogue,
    }),
  });

  return {
    usageSlices: slices,
    memoriesRetrieved,
  };
}
