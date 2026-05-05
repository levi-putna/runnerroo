import "server-only";

import { gateway } from "@ai-sdk/gateway";
import { embed } from "ai";

import {
  buildRunnerGatewayProviderOptions,
  gatewayUsageTagsForMemoryEmbedding,
} from "@/lib/ai-gateway/runner-gateway-tracking";

const DEFAULT_GATEWAY_EMBEDDING_MODEL_ID = "openai/text-embedding-3-small";
const MEMORY_EMBEDDING_DIMENSIONS = 1536;

function resolveGatewayEmbeddingModelId(): string {
  return (
    process.env.MEMORY_EMBEDDING_MODEL?.trim() ||
    DEFAULT_GATEWAY_EMBEDDING_MODEL_ID
  );
}

/**
 * Creates a normalised embedding vector for memory storage or hybrid search via the AI Gateway.
 */
export async function createMemoryEmbedding({
  text,
  supabaseUserId,
  embeddingPurpose,
}: {
  text: string;
  supabaseUserId: string;
  embeddingPurpose: "memory_write" | "memory_query";
}): Promise<number[]> {
  const value = text.trim();
  if (!value) {
    throw new Error("Cannot create memory embedding for empty text.");
  }

  const providerOptions = buildRunnerGatewayProviderOptions({
    supabaseUserId,
    tags: gatewayUsageTagsForMemoryEmbedding({ purpose: embeddingPurpose }),
  });

  try {
    const { embedding } = await embed({
      model: gateway.textEmbeddingModel(resolveGatewayEmbeddingModelId()),
      value,
      providerOptions,
    });

    const vector = Array.from(embedding as ArrayLike<number>);
    if (vector.length !== MEMORY_EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${MEMORY_EMBEDDING_DIMENSIONS}-dimension embedding; received ${vector.length}.`,
      );
    }

    return vector;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown embedding error";
    throw new Error(`Unable to create memory embedding: ${message}`);
  }
}
