/** Raw model record from AI Gateway `GET /v1/models` (subset used for usage cost estimates). */
export type AiGatewayModelsListResponse = {
  object?: string;
  data: AiGatewayRawModel[];
};

export type AiGatewayRawModel = {
  id: string;
  object?: string;
  released: number;
  owned_by?: string;
  name?: string;
  context_window?: number;
  max_tokens?: number;
  type?: string;
  tags?: string[];
  pricing?: {
    input?: string;
    output?: string;
    input_tiers?: Array<{ cost: string; min: number; max?: number }>;
    output_tiers?: Array<{ cost: string; min: number; max?: number }>;
    [key: string]: unknown;
  };
};

let cachedList: { models: AiGatewayRawModel[]; fetchedAt: number } | null = null;

const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Fetches the full model catalogue from Vercel AI Gateway (uncached network; use sparingly).
 */
export async function fetchAiGatewayModelList(): Promise<AiGatewayRawModel[]> {
  const headers: HeadersInit = { Accept: "application/json" };
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }

  const response = await fetch(GATEWAY_MODELS_URL, { headers });
  if (!response.ok) {
    throw new Error(`AI Gateway models request failed: ${response.status}`);
  }
  const json = (await response.json()) as AiGatewayModelsListResponse;
  if (!Array.isArray(json.data)) {
    throw new Error("AI Gateway models response missing data array");
  }
  return json.data;
}

/**
 * Returns the model list with in-memory TTL to avoid hammering the public catalogue.
 */
export async function getAiGatewayModelListCached(): Promise<AiGatewayRawModel[]> {
  const now = Date.now();
  if (cachedList && now - cachedList.fetchedAt < CACHE_TTL_MS) {
    return cachedList.models;
  }
  const models = await fetchAiGatewayModelList();
  cachedList = { models, fetchedAt: now };
  return models;
}
