import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

import { buildRunnerGatewayProviderOptions } from "@/lib/ai-gateway/runner-gateway-tracking";

/** Default judge model — cheap Gateway slug aligned with title generation in [`app/api/chat/route.ts`](app/api/chat/route.ts). */
const DEFAULT_JUDGE_MODEL_ID = "openai/gpt-5.4-nano";

const verdictSchema = z.object({
  appropriate: z.boolean(),
  reason: z.string(),
});

/**
 * Whether `AI_GATEWAY_API_KEY` is available in this process (Playwright loads `.env.playwright.local`).
 */
export function hasAiGatewayApiKeyForPlaywright(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
}

/**
 * When false, specs should skip the LLM-as-judge assertion (`PLAYWRIGHT_ASSISTANT_JUDGE=0`).
 */
export function isAssistantLlmJudgeEnabled(): boolean {
  return process.env.PLAYWRIGHT_ASSISTANT_JUDGE?.trim() !== "0";
}

/**
 * Resolves the Gateway model id used only for the Playwright judge call.
 */
export function resolveAssistantJudgeModelId(): string {
  const fromEnv = process.env.PLAYWRIGHT_ASSISTANT_JUDGE_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_JUDGE_MODEL_ID;
}

/**
 * Extracts a single JSON object from model output (plain JSON or fenced code block).
 */
function extractJsonObject({ text }: { text: string }): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in judge output");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

/**
 * Uses a small `generateText` call via Vercel AI Gateway to decide if the assistant reply fits the user message.
 *
 * @throws When the Gateway returns unparseable JSON or the verdict schema fails.
 */
export async function evaluateAssistantReplyAppropriateness({
  userMessage,
  assistantReply,
}: {
  userMessage: string;
  assistantReply: string;
}): Promise<{ appropriate: boolean; reason: string }> {
  if (!hasAiGatewayApiKeyForPlaywright()) {
    throw new Error("evaluateAssistantReplyAppropriateness requires AI_GATEWAY_API_KEY in the Playwright process env");
  }

  const judgeModelId = resolveAssistantJudgeModelId();
  const providerOptions = buildRunnerGatewayProviderOptions({
    supabaseUserId: null,
    tags: ["e2e:assistant-judge"],
  });

  const { text } = await generateText({
    model: gateway.languageModel(judgeModelId),
    providerOptions,
    prompt: `You are a strict evaluator for automated tests.

User message:
"""
${userMessage.slice(0, 2000)}
"""

Assistant reply:
"""
${assistantReply.slice(0, 8000)}
"""

Reply with a single JSON object only (no markdown, no prose outside JSON) using this shape:
{"appropriate": true or false, "reason": "one short sentence"}

"appropriate" is true when the assistant reply is a normal, good-faith conversational response to the user (e.g. a greeting gets a polite greeting or helpful reply). It is false when the reply is empty, off-topic, an error blob, or clearly broken.`,
  });

  const parsed = extractJsonObject({ text });
  return verdictSchema.parse(parsed);
}
