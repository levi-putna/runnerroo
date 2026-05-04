import type { GatewayModel } from './types';

/**
 * Default model ID used when no selection exists or the saved ID is no longer in the catalogue.
 * Points to a well-rounded mid-tier model suitable for general-purpose text tasks.
 */
export const DEFAULT_MODEL_ID = 'openai/gpt-5.4-mini';

/**
 * Static catalogue of Vercel AI Gateway models.
 *
 * Data sourced from https://vercel.com/ai-gateway/models
 * Update this list when new models become available on the Gateway.
 *
 * Latency tiers:  3 = fast (< 1s), 2 = medium (1–2.5s), 1 = slow (> 2.5s)
 * Throughput tiers: 3 = high (> 150 tps), 2 = medium (80–150 tps), 1 = low (< 80 tps)
 * Cost tiers: 0 = standard, 1 = moderate ($14–$24.99/M out), 2 = premium ($25/M+ out)
 */
export const GATEWAY_MODELS: GatewayModel[] = [
  // ─── xAI ──────────────────────────────────────────────────────────────────
  {
    id: 'xai/grok-4.3',
    shortName: 'Grok 4.3',
    providerKey: 'xai',
    providerLabel: 'xAI',
    type: 'text',
    contextLabel: '1M',
    inputPriceLabel: '$1.25/M',
    outputPriceLabel: '$2.50/M',
    latencyLevel: 3,
    throughputLevel: 2,
    costDollarTier: 0,
    featured: true,
  },
  {
    id: 'xai/grok-4.20-reasoning-beta',
    shortName: 'Grok 4.20 Reasoning',
    providerKey: 'xai',
    providerLabel: 'xAI',
    type: 'text',
    contextLabel: '2M',
    inputPriceLabel: '$2.00/M',
    outputPriceLabel: '$6.00/M',
    latencyLevel: 3,
    throughputLevel: 2,
    costDollarTier: 0,
  },
  {
    id: 'xai/grok-4.20-non-reasoning-beta',
    shortName: 'Grok 4.20',
    providerKey: 'xai',
    providerLabel: 'xAI',
    type: 'text',
    contextLabel: '2M',
    inputPriceLabel: '$2.00/M',
    outputPriceLabel: '$6.00/M',
    latencyLevel: 2,
    throughputLevel: 2,
    costDollarTier: 0,
  },

  // ─── OpenAI ───────────────────────────────────────────────────────────────
  {
    id: 'openai/gpt-5.5',
    shortName: 'GPT-5.5',
    providerKey: 'openai',
    providerLabel: 'OpenAI',
    type: 'text',
    contextLabel: '1M',
    inputPriceLabel: '$5.00/M',
    outputPriceLabel: '$30.00/M',
    latencyLevel: 1,
    throughputLevel: 3,
    costDollarTier: 2,
    featured: true,
  },
  {
    id: 'openai/gpt-5.5-pro',
    shortName: 'GPT-5.5 Pro',
    providerKey: 'openai',
    providerLabel: 'OpenAI',
    type: 'text',
    contextLabel: '1M',
    inputPriceLabel: '$30.00/M',
    outputPriceLabel: '$180.00/M',
    latencyLevel: 1,
    throughputLevel: 1,
    costDollarTier: 2,
  },
  {
    id: 'openai/gpt-5.4-mini',
    shortName: 'GPT-5.4 Mini',
    providerKey: 'openai',
    providerLabel: 'OpenAI',
    type: 'text',
    contextLabel: '400K',
    inputPriceLabel: '$0.75/M',
    outputPriceLabel: '$4.50/M',
    latencyLevel: 1,
    throughputLevel: 3,
    costDollarTier: 0,
    featured: true,
  },
  {
    id: 'openai/gpt-5.4-nano',
    shortName: 'GPT-5.4 Nano',
    providerKey: 'openai',
    providerLabel: 'OpenAI',
    type: 'text',
    contextLabel: '400K',
    inputPriceLabel: '$0.20/M',
    outputPriceLabel: '$1.25/M',
    latencyLevel: 3,
    throughputLevel: 2,
    costDollarTier: 0,
  },
  {
    id: 'openai/gpt-image-2',
    shortName: 'GPT Image 2',
    providerKey: 'openai',
    providerLabel: 'OpenAI',
    type: 'image',
    contextLabel: null,
    inputPriceLabel: '$5.00/M',
    outputPriceLabel: '$30.00/M',
    latencyLevel: null,
    throughputLevel: null,
    costDollarTier: 2,
    featured: true,
  },

  // ─── Anthropic ────────────────────────────────────────────────────────────
  {
    id: 'anthropic/claude-opus-4.7',
    shortName: 'Claude Opus 4.7',
    providerKey: 'anthropic',
    providerLabel: 'Anthropic',
    type: 'text',
    contextLabel: '1M',
    inputPriceLabel: '$5.00/M',
    outputPriceLabel: '$25.00/M',
    latencyLevel: 3,
    throughputLevel: 2,
    costDollarTier: 2,
    featured: true,
  },

  // ─── DeepSeek ─────────────────────────────────────────────────────────────
  {
    id: 'deepseek/deepseek-v4-pro',
    shortName: 'DeepSeek V4 Pro',
    providerKey: 'deepseek',
    providerLabel: 'DeepSeek',
    type: 'text',
    contextLabel: '1M',
    inputPriceLabel: '$0.43/M',
    outputPriceLabel: '$0.87/M',
    latencyLevel: 3,
    throughputLevel: 1,
    costDollarTier: 0,
    featured: true,
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    shortName: 'DeepSeek V4 Flash',
    providerKey: 'deepseek',
    providerLabel: 'DeepSeek',
    type: 'text',
    contextLabel: '1M',
    inputPriceLabel: '$0.14/M',
    outputPriceLabel: '$0.28/M',
    latencyLevel: 3,
    throughputLevel: 2,
    costDollarTier: 0,
  },

  // ─── Google ───────────────────────────────────────────────────────────────
  {
    id: 'google/gemma-4-31b-it',
    shortName: 'Gemma 4 31B',
    providerKey: 'google',
    providerLabel: 'Google',
    type: 'text',
    contextLabel: '262K',
    inputPriceLabel: '$0.14/M',
    outputPriceLabel: '$0.40/M',
    latencyLevel: 1,
    throughputLevel: 1,
    costDollarTier: 0,
  },
  {
    id: 'google/gemma-4-26b-a4b-it',
    shortName: 'Gemma 4 26B MoE',
    providerKey: 'google',
    providerLabel: 'Google',
    type: 'text',
    contextLabel: '262K',
    inputPriceLabel: '$0.13/M',
    outputPriceLabel: '$0.40/M',
    latencyLevel: 3,
    throughputLevel: 1,
    costDollarTier: 0,
  },

  // ─── Alibaba ──────────────────────────────────────────────────────────────
  {
    id: 'alibaba/qwen3.6-27b',
    shortName: 'Qwen 3.6 27B',
    providerKey: 'alibaba',
    providerLabel: 'Alibaba',
    type: 'text',
    contextLabel: '256K',
    inputPriceLabel: '$0.60/M',
    outputPriceLabel: '$3.60/M',
    latencyLevel: 1,
    throughputLevel: 1,
    costDollarTier: 0,
  },
  {
    id: 'alibaba/qwen3.6-plus',
    shortName: 'Qwen 3.6 Plus',
    providerKey: 'alibaba',
    providerLabel: 'Alibaba',
    type: 'text',
    contextLabel: '1M',
    inputPriceLabel: '$0.50/M',
    outputPriceLabel: '$3.00/M',
    latencyLevel: 3,
    throughputLevel: 1,
    costDollarTier: 0,
  },
  {
    id: 'alibaba/qwen-3.6-max-preview',
    shortName: 'Qwen 3.6 Max',
    providerKey: 'alibaba',
    providerLabel: 'Alibaba',
    type: 'text',
    contextLabel: '240K',
    inputPriceLabel: '$1.30/M',
    outputPriceLabel: '$7.80/M',
    latencyLevel: 1,
    throughputLevel: 1,
    costDollarTier: 0,
  },

  // ─── Xiaomi ───────────────────────────────────────────────────────────────
  {
    id: 'xiaomi/mimo-v2.5-pro',
    shortName: 'MiMo V2.5 Pro',
    providerKey: 'xiaomi',
    providerLabel: 'Xiaomi',
    type: 'text',
    contextLabel: '1.1M',
    inputPriceLabel: '$1.00/M',
    outputPriceLabel: '$3.00/M',
    latencyLevel: 1,
    throughputLevel: 1,
    costDollarTier: 0,
  },
  {
    id: 'xiaomi/mimo-v2.5',
    shortName: 'MiMo V2.5',
    providerKey: 'xiaomi',
    providerLabel: 'Xiaomi',
    type: 'text',
    contextLabel: '1.1M',
    inputPriceLabel: '$0.40/M',
    outputPriceLabel: '$2.00/M',
    latencyLevel: 2,
    throughputLevel: 2,
    costDollarTier: 0,
  },
  {
    id: 'xiaomi/mimo-v2-pro',
    shortName: 'MiMo V2 Pro',
    providerKey: 'xiaomi',
    providerLabel: 'Xiaomi',
    type: 'text',
    contextLabel: '1M',
    inputPriceLabel: '$1.00/M',
    outputPriceLabel: '$3.00/M',
    latencyLevel: 1,
    throughputLevel: 1,
    costDollarTier: 0,
  },

  // ─── Moonshot AI ──────────────────────────────────────────────────────────
  {
    id: 'moonshotai/kimi-k2.6',
    shortName: 'Kimi K2.6',
    providerKey: 'moonshotai',
    providerLabel: 'Moonshot AI',
    type: 'text',
    contextLabel: '262K',
    inputPriceLabel: '$0.95/M',
    outputPriceLabel: '$4.00/M',
    latencyLevel: 3,
    throughputLevel: 2,
    costDollarTier: 0,
  },

  // ─── ZAI ──────────────────────────────────────────────────────────────────
  {
    id: 'zai/glm-5.1',
    shortName: 'GLM-5.1',
    providerKey: 'zai',
    providerLabel: 'ZAI',
    type: 'text',
    contextLabel: '205K',
    inputPriceLabel: '$1.40/M',
    outputPriceLabel: '$4.40/M',
    latencyLevel: 3,
    throughputLevel: 1,
    costDollarTier: 0,
  },
  {
    id: 'zai/glm-5v-turbo',
    shortName: 'GLM-5V Turbo',
    providerKey: 'zai',
    providerLabel: 'ZAI',
    type: 'text',
    contextLabel: '200K',
    inputPriceLabel: '$1.20/M',
    outputPriceLabel: '$4.00/M',
    latencyLevel: 1,
    throughputLevel: 2,
    costDollarTier: 0,
  },
  {
    id: 'zai/glm-5-turbo',
    shortName: 'GLM-5 Turbo',
    providerKey: 'zai',
    providerLabel: 'ZAI',
    type: 'text',
    contextLabel: '203K',
    inputPriceLabel: '$1.20/M',
    outputPriceLabel: '$4.00/M',
    latencyLevel: 1,
    throughputLevel: 2,
    costDollarTier: 0,
  },

  // ─── Arcee AI ─────────────────────────────────────────────────────────────
  {
    id: 'arcee-ai/trinity-large-thinking',
    shortName: 'Trinity Large Thinking',
    providerKey: 'arcee-ai',
    providerLabel: 'Arcee AI',
    type: 'text',
    contextLabel: '262K',
    inputPriceLabel: '$0.25/M',
    outputPriceLabel: '$0.90/M',
    latencyLevel: 2,
    throughputLevel: 3,
    costDollarTier: 0,
  },

  // ─── KwaiPilot ────────────────────────────────────────────────────────────
  {
    id: 'kwaipilot/kat-coder-pro-v2',
    shortName: 'KAT Coder Pro V2',
    providerKey: 'kwaipilot',
    providerLabel: 'KwaiPilot',
    type: 'text',
    contextLabel: '256K',
    inputPriceLabel: '$0.30/M',
    outputPriceLabel: '$1.20/M',
    latencyLevel: 1,
    throughputLevel: 2,
    costDollarTier: 0,
  },

  // ─── MiniMax ──────────────────────────────────────────────────────────────
  {
    id: 'minimax/minimax-m2.7',
    shortName: 'MiniMax M2.7',
    providerKey: 'minimax',
    providerLabel: 'MiniMax',
    type: 'text',
    contextLabel: '205K',
    inputPriceLabel: '$0.30/M',
    outputPriceLabel: '$1.20/M',
    latencyLevel: 3,
    throughputLevel: 2,
    costDollarTier: 0,
  },
  {
    id: 'minimax/minimax-m2.7-highspeed',
    shortName: 'MiniMax M2.7 Highspeed',
    providerKey: 'minimax',
    providerLabel: 'MiniMax',
    type: 'text',
    contextLabel: '205K',
    inputPriceLabel: '$0.60/M',
    outputPriceLabel: '$2.40/M',
    latencyLevel: 2,
    throughputLevel: 1,
    costDollarTier: 0,
  },

  // ─── NVIDIA ───────────────────────────────────────────────────────────────
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    shortName: 'Nemotron Super 120B',
    providerKey: 'nvidia',
    providerLabel: 'NVIDIA',
    type: 'text',
    contextLabel: '256K',
    inputPriceLabel: '$0.15/M',
    outputPriceLabel: '$0.65/M',
    latencyLevel: 3,
    throughputLevel: 3,
    costDollarTier: 0,
  },

  // ─── ByteDance ────────────────────────────────────────────────────────────
  {
    id: 'bytedance/seedance-2.0',
    shortName: 'Seedance 2.0',
    providerKey: 'bytedance',
    providerLabel: 'ByteDance',
    type: 'video',
    contextLabel: null,
    inputPriceLabel: null,
    outputPriceLabel: null,
    latencyLevel: null,
    throughputLevel: null,
    costDollarTier: 0,
    featured: true,
  },
  {
    id: 'bytedance/seedance-2.0-fast',
    shortName: 'Seedance 2.0 Fast',
    providerKey: 'bytedance',
    providerLabel: 'ByteDance',
    type: 'video',
    contextLabel: null,
    inputPriceLabel: null,
    outputPriceLabel: null,
    latencyLevel: null,
    throughputLevel: null,
    costDollarTier: 0,
  },
];

/**
 * Returns all models filtered by the given type.
 */
export function getModelsByType(type: GatewayModel['type']): GatewayModel[] {
  return GATEWAY_MODELS.filter((m) => m.type === type);
}

/**
 * Returns models marked as featured, optionally filtered by type.
 */
export function getFeaturedModels(type?: GatewayModel['type']): GatewayModel[] {
  return GATEWAY_MODELS.filter((m) => m.featured && (!type || m.type === type));
}

/**
 * Looks up a model by its fully qualified ID. Returns undefined if not found.
 */
export function findModelById(id: string): GatewayModel | undefined {
  return GATEWAY_MODELS.find((m) => m.id === id);
}

/**
 * Normalises a stored workflow model identifier to a `provider/model` slug for the Vercel AI Gateway.
 *
 * The Model selector already persists gateway-qualified IDs; older graphs may store shorthand IDs
 * (for example Claude or GPT base names without a provider prefix).
 */
export function resolveWorkflowGatewayModelId({ modelId }: { modelId: string }): string {
  const trimmed = modelId.trim();
  if (!trimmed) return DEFAULT_MODEL_ID;

  // Already gateway-qualified (catalogue IDs and any explicit provider/model slug).
  if (trimmed.includes('/')) return trimmed;

  if (trimmed.startsWith('claude')) return `anthropic/${trimmed}`;
  if (trimmed.startsWith('gpt') || trimmed.startsWith('o1') || trimmed.startsWith('o3')) {
    return `openai/${trimmed}`;
  }

  return DEFAULT_MODEL_ID;
}
