/**
 * Allowed values for the assistant role setting.
 * Controls which life domain the assistant prioritises.
 */
export const ASSISTANT_ROLES = [
  'general_assistant',
  'personal_assistant',
  'executive_assistant',
] as const;

export type AssistantRole = (typeof ASSISTANT_ROLES)[number];

/** Human-readable labels for each role value. */
export const ASSISTANT_ROLE_LABELS: Record<AssistantRole, string> = {
  general_assistant: 'General assistant',
  personal_assistant: 'Personal assistant',
  executive_assistant: 'Executive assistant',
};

export const ASSISTANT_ROLE_DESCRIPTIONS: Record<AssistantRole, string> = {
  general_assistant: 'Handles everything — work, personal, family. Uses context to infer which domain is relevant.',
  personal_assistant: 'Focused on personal life, family, lifestyle, and home.',
  executive_assistant: 'Focused on work and professional life.',
};

/**
 * Allowed values for the recommendation style setting.
 */
export const RECOMMENDATION_STYLES = [
  'always_give_options',
  'always_recommend_one',
  'recommend_one_with_alternatives',
] as const;

export type RecommendationStyle = (typeof RECOMMENDATION_STYLES)[number];

export const RECOMMENDATION_STYLE_LABELS: Record<RecommendationStyle, string> = {
  always_give_options: 'Always give options',
  always_recommend_one: 'Always recommend one',
  recommend_one_with_alternatives: 'Recommend one with alternatives briefly noted',
};

export const RECOMMENDATION_STYLE_DESCRIPTIONS: Record<RecommendationStyle, string> = {
  always_give_options: 'Always lay out options so you can decide.',
  always_recommend_one: 'Always give a direct recommendation with reasoning.',
  recommend_one_with_alternatives: 'Recommend one option with a short rationale, and mention if there\'s a meaningful alternative worth considering.',
};

/** `default_output_format` is a free-text field — no enum constraint. */
export type DefaultOutputFormat = string;

/**
 * Allowed values for the clarification behaviour setting.
 */
export const CLARIFICATION_BEHAVIOURS = [
  'always_ask_first',
  'assume_and_note',
  'just_execute',
] as const;

export type ClarificationBehaviour = (typeof CLARIFICATION_BEHAVIOURS)[number];

export const CLARIFICATION_BEHAVIOUR_LABELS: Record<ClarificationBehaviour, string> = {
  always_ask_first: 'Always ask first',
  assume_and_note: 'Assume and note assumptions',
  just_execute: 'Just execute',
};

export const CLARIFICATION_BEHAVIOUR_DESCRIPTIONS: Record<ClarificationBehaviour, string> = {
  always_ask_first: 'Ask clarifying questions before starting any task.',
  assume_and_note: 'Make a reasonable start and state what was assumed, so you can redirect if needed.',
  just_execute: 'Execute immediately without clarifying.',
};

/**
 * The full assistant settings row as stored in the database.
 */
export type AssistantSettings = {
  user_id: string;
  role: AssistantRole;
  voice_and_tone: string;
  things_to_never_say: string;
  recommendation_style: RecommendationStyle;
  default_output_format: DefaultOutputFormat;
  clarification_behaviour: ClarificationBehaviour;
  updated_at: string;
};

/**
 * Partial update payload — all fields optional.
 */
export type AssistantSettingsPatch = Partial<Omit<AssistantSettings, 'user_id' | 'updated_at'>>;

/**
 * Default values matching the migration column defaults.
 * Used when no row exists yet for a user.
 */
export const DEFAULT_ASSISTANT_SETTINGS: Omit<AssistantSettings, 'user_id' | 'updated_at'> = {
  role: 'general_assistant',
  voice_and_tone: 'Business casual, friendly but professional. No corporate fluff.',
  things_to_never_say: 'Avoid filler affirmations (e.g. "Certainly!", "Great question!"). Avoid cliched business phrases. Never use an em dash.',
  recommendation_style: 'recommend_one_with_alternatives',
  default_output_format: 'Prose for narrative tasks, bullet points for action items and lists. Always lead with the most important thing.',
  clarification_behaviour: 'assume_and_note',
};
