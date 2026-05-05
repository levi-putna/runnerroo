import type { LanguageModelUsage } from "ai";

import { gatewayTokenUsdToUsdPerMillion } from "@/lib/ai-gateway/format-gateway-token-price";
import type { AiGatewayRawModel } from "@/lib/ai-gateway/gateway-raw-models";

/**
 * Estimates USD cost for a usage record using flat input/output catalogue rates.
 */
export function estimateCostUsdForUsage({
  usage,
  modelId,
  catalogue,
}: {
  usage: LanguageModelUsage;
  modelId: string;
  catalogue: AiGatewayRawModel[];
}): number | null {
  const row = catalogue.find((m) => m.id === modelId);
  if (!row?.pricing) {
    return null;
  }

  const inputUsdPerMillion = gatewayTokenUsdToUsdPerMillion(row.pricing.input);
  const outputUsdPerMillion = gatewayTokenUsdToUsdPerMillion(row.pricing.output);
  if (inputUsdPerMillion === null && outputUsdPerMillion === null) {
    return null;
  }

  const inputTok = usage.inputTokens ?? 0;
  const outputTok =
    usage.outputTokens ??
    (usage.outputTokenDetails?.textTokens ?? 0) + (usage.outputTokenDetails?.reasoningTokens ?? 0);

  let usd = 0;
  if (inputUsdPerMillion !== null && inputTok > 0) {
    usd += (inputTok / 1_000_000) * inputUsdPerMillion;
  }
  if (outputUsdPerMillion !== null && outputTok > 0) {
    usd += (outputTok / 1_000_000) * outputUsdPerMillion;
  }

  return usd > 0 ? usd : 0;
}
