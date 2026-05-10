import type { CostDollarTier, GatewayModel, ModelType } from '@/lib/ai-gateway/types';
import { getFeaturedGatewayModelIds, getStaticGatewayModelSpeedTiersById } from '@/lib/ai-gateway/models';

/** One row from `GET https://ai-gateway.vercel.sh/v1/models` (snake_case fields). */
type GatewayV1ModelsApiRow = {
  id: string;
  name?: string;
  owned_by?: string;
  /** Unix epoch seconds or milliseconds from the gateway catalogue, when present. */
  released?: number;
  context_window?: number;
  max_tokens?: number;
  type?: string;
  pricing?: {
    input?: string;
    output?: string;
    image?: string;
    input_tiers?: Array<{ cost: string; min: number; max?: number }>;
    output_tiers?: Array<{ cost: string; min: number; max?: number }>;
  };
};

const STATIC_SPEED = getStaticGatewayModelSpeedTiersById();

/** Pretty provider labels for browse grouping; unknown keys stay title-cased from the slug. */
const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  xai: 'xAI',
  alibaba: 'Alibaba',
  deepseek: 'DeepSeek',
  moonshotai: 'Moonshot AI',
  zai: 'ZAI',
  bytedance: 'ByteDance',
  nvidia: 'NVIDIA',
  minimax: 'MiniMax',
  xiaomi: 'Xiaomi',
  arcee: 'Arcee AI',
  'arcee-ai': 'Arcee AI',
  kwaipilot: 'KwaiPilot',
  vercel: 'Vercel',
};

/**
 * Maps a gateway API `type` to the selector’s {@link ModelType}. Unsupported types are omitted from the catalogue.
 */
function gatewayApiTypeToModelType(apiType: string): ModelType | null {
  switch (apiType) {
    case 'language':
      return 'text';
    case 'image':
      return 'image';
    case 'video':
      return 'video';
    case 'embedding':
      return 'embed';
    default:
      return null;
  }
}

/**
 * Formats a context window in tokens for the selector’s subtitle line (e.g. 1_000_000 → "1M").
 */
function formatContextLabel({ tokens }: { tokens: number | undefined }): string | null {
  if (tokens == null || !Number.isFinite(tokens) || tokens <= 0) {
    return null;
  }
  const t = Math.round(tokens);
  if (t >= 1_000_000) {
    const m = t / 1_000_000;
    const label = Number.isInteger(m) ? String(m) : String(Math.round(m * 10) / 10).replace(/\.0$/, '');
    return `${label}M`;
  }
  if (t >= 1000) {
    return `${Math.round(t / 1000)}K`;
  }
  return String(t);
}

/**
 * Converts per-token USD string from the API to dollars per million tokens.
 */
function perTokenToPerMillionUsd({ perToken }: { perToken: string | undefined }): number | null {
  if (perToken == null) return null;
  const n = Number(perToken);
  if (!Number.isFinite(n)) return null;
  return n * 1_000_000;
}

/**
 * Formats a per-million-USD amount like existing catalogue labels (`$0.75/M`).
 */
function formatUsdPerMillionTokens({ usdPerMillion }: { usdPerMillion: number }): string {
  const x = Math.abs(usdPerMillion);
  const digits = x >= 100 ? 0 : x >= 10 ? 1 : x >= 1 ? 2 : 3;
  const s = usdPerMillion.toFixed(digits).replace(/\.?0+$/, '');
  return `$${s}/M`;
}

/**
 * Derives the coarse cost tier from output USD/M (same bands as the static catalogue comments).
 */
function outputPerMillionToCostTier({ outPerM }: { outPerM: number | null }): CostDollarTier {
  if (outPerM == null || !Number.isFinite(outPerM)) return 0;
  if (outPerM >= 25) return 2;
  if (outPerM >= 14) return 1;
  return 0;
}

/**
 * Formats the gateway `released` field for display (Australian English locale, UTC calendar date).
 */
function formatModelReleaseDateLabel({ released }: { released: number | undefined }): string | null {
  if (released == null || !Number.isFinite(released)) return null;
  const asMs = released > 10_000_000_000 ? released : released * 1000;
  const d = new Date(asMs);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" }).format(d);
}

/**
 * Resolves display name for the provider segment of a model id (`owner/slug`).
 */
function providerLabelForKey({ key }: { key: string }): string {
  const normalised = key.toLowerCase();
  return PROVIDER_LABELS[normalised] ?? key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parses the JSON body of `GET /v1/models` into normalised {@link GatewayModel} entries for the selector.
 */
export function gatewayV1ModelsResponseToGatewayModels({ body }: { body: unknown }): GatewayModel[] {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    return [];
  }

  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return [];
  }

  const featuredList = [...getFeaturedGatewayModelIds()];
  const featuredIds = new Set(featuredList);
  const featuredOrderById = new Map(featuredList.map((id, i) => [id, i]));

  const out: GatewayModel[] = [];

  for (const raw of data) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as GatewayV1ModelsApiRow;
    if (typeof row.id !== 'string' || !row.id.includes('/')) continue;
    const apiType = typeof row.type === 'string' ? row.type : '';
    const modelType = gatewayApiTypeToModelType(apiType);
    if (modelType == null) continue;

    const [providerKey] = row.id.split('/');
    if (!providerKey) continue;

    const ownedBy = typeof row.owned_by === 'string' && row.owned_by.length > 0 ? row.owned_by : providerKey;
    const providerLabel = providerLabelForKey({ key: ownedBy });

    const inputPerM = perTokenToPerMillionUsd({ perToken: row.pricing?.input });
    const outputPerM = perTokenToPerMillionUsd({ perToken: row.pricing?.output });

    const inputPriceLabel: string | null =
      inputPerM != null && inputPerM > 0 ? formatUsdPerMillionTokens({ usdPerMillion: inputPerM }) : null;
    let outputPriceLabel: string | null =
      outputPerM != null && outputPerM > 0 ? formatUsdPerMillionTokens({ usdPerMillion: outputPerM }) : null;

    if (modelType === 'image' && row.pricing?.image != null) {
      const perImage = Number(row.pricing.image);
      if (Number.isFinite(perImage) && perImage > 0) {
        outputPriceLabel = `$${perImage.toFixed(2)}/img`;
      }
    }

    const costDollarTier = outputPerMillionToCostTier({ outPerM: outputPerM });

    const speed = STATIC_SPEED.get(row.id);

    const featured = featuredIds.has(row.id);

    const shortName =
      typeof row.name === 'string' && row.name.trim().length > 0 ? row.name.trim() : row.id.split('/')[1] ?? row.id;

    let contextLabel = formatContextLabel({ tokens: row.context_window });
    if ((modelType === 'image' || modelType === 'video') && contextLabel == null) {
      contextLabel = null;
    }

    const releaseDateLabel = formatModelReleaseDateLabel({ released: row.released });

    out.push({
      id: row.id,
      shortName,
      providerKey: providerKey.toLowerCase(),
      providerLabel,
      type: modelType,
      contextLabel,
      inputPriceLabel,
      outputPriceLabel,
      releaseDateLabel,
      latencyLevel: speed?.latencyLevel ?? null,
      throughputLevel: speed?.throughputLevel ?? null,
      costDollarTier,
      ...(featured
        ? { featured: true, featuredOrder: featuredOrderById.get(row.id) ?? 0 }
        : {}),
    });
  }

  out.sort((a, b) => {
    const byProvider = a.providerLabel.localeCompare(b.providerLabel);
    if (byProvider !== 0) return byProvider;
    return a.shortName.localeCompare(b.shortName);
  });

  return out;
}
