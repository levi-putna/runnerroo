import type { LanguageModelUsage } from "ai";

export type UsagePhase = "planning" | "assistant";

export type ModelUsageSlice = {
  modelId: string;
  phase: UsagePhase;
  usage: LanguageModelUsage;
  estimatedCostUsd: number | null;
};

export type AssistantMessageMetadata = {
  usageSlices: ModelUsageSlice[];
  memoriesRetrieved?: Array<{ id: string; type: string; key: string; preview: string }>;
};
