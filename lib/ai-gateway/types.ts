/** Capability category for a Vercel AI Gateway model. */
export type ModelType = 'text' | 'image' | 'video' | 'embed';

/** Performance speed tier — 1 = low/slow, 2 = medium, 3 = high/fast. */
export type ModelSpeedLevel = 1 | 2 | 3;

/** Cost indicator tier — 0 = standard, 1 = moderate ($14–$24.99/M out), 2 = premium ($25/M+ out). */
export type CostDollarTier = 0 | 1 | 2;

/** A single model entry in the Vercel AI Gateway catalogue. */
export interface GatewayModel {
  /** Fully qualified model ID as used in the Vercel AI Gateway, e.g. "openai/gpt-5.4-mini". */
  id: string;

  /** Short human-readable model name, e.g. "GPT-5.4 Mini". */
  shortName: string;

  /** Provider slug key, e.g. "openai". */
  providerKey: string;

  /** Human-readable provider label, e.g. "OpenAI". */
  providerLabel: string;

  /** Primary capability category for this model. */
  type: ModelType;

  /** Context window size label, e.g. "400K". Null if not applicable for this model type. */
  contextLabel: string | null;

  /** Formatted input price per million tokens, e.g. "$0.75/M". Null if unavailable. */
  inputPriceLabel: string | null;

  /** Formatted output price per million tokens, e.g. "$4.50/M". Null if unavailable. */
  outputPriceLabel: string | null;

  /**
   * Latency performance tier: 3 = fast (< 1s), 2 = medium (1–2.5s), 1 = slow (> 2.5s).
   * Null for model types where latency is not applicable (e.g. image/video).
   */
  latencyLevel: ModelSpeedLevel | null;

  /**
   * Throughput performance tier: 3 = high (> 150 tps), 2 = medium (80–150 tps), 1 = low (< 80 tps).
   * Null for model types where throughput is not applicable.
   */
  throughputLevel: ModelSpeedLevel | null;

  /** Cost indicator tier: 0 = standard, 1 = moderate, 2 = premium. */
  costDollarTier: CostDollarTier;

  /** Whether this model appears in the curated "Featured" quick-pick list. */
  featured?: boolean;
}

/** Groups models by provider for the browse UI. */
export interface ProviderBucket {
  key: string;
  label: string;
  models: GatewayModel[];
}

/** Display labels for each model type tab in the selector. */
export const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  text: 'Text',
  image: 'Image',
  video: 'Video',
  embed: 'Embed',
};
