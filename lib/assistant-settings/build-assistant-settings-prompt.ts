import {
  ASSISTANT_ROLE_LABELS,
  CLARIFICATION_BEHAVIOUR_LABELS,
  RECOMMENDATION_STYLE_LABELS,
  type AssistantSettings,
} from './types';

/**
 * Converts the user's assistant settings row into a system-prompt block that is
 * injected on every chat turn. Returns `null` if settings are all at their defaults
 * and the block would add no meaningful signal (future optimisation; currently always returns).
 */
export function buildAssistantSettingsPromptBlock(settings: AssistantSettings): string {
  const roleLabel = ASSISTANT_ROLE_LABELS[settings.role];
  const recommendationLabel = RECOMMENDATION_STYLE_LABELS[settings.recommendation_style];
  const clarificationLabel = CLARIFICATION_BEHAVIOUR_LABELS[settings.clarification_behaviour];

  return `## User assistant preferences

The user has configured the following behaviour preferences. Apply them on every response unless the user explicitly overrides them in the current message.

**Role:** ${roleLabel}
${roleRoleGuidance(settings.role)}

**Voice and tone:** ${settings.voice_and_tone}

**Things to never say:** ${settings.things_to_never_say}

**Recommendation style:** ${recommendationLabel}
${recommendationGuidance(settings.recommendation_style)}

**Default output format:** ${settings.default_output_format}

**Clarification behaviour:** ${clarificationLabel}
${clarificationGuidance(settings.clarification_behaviour)}`.trim();
}

function roleRoleGuidance(role: AssistantSettings['role']): string {
  switch (role) {
    case 'personal_assistant':
      return 'Prioritise personal life, family, lifestyle, and home tasks. When context is ambiguous, lean toward personal rather than professional framing.';
    case 'executive_assistant':
      return 'Prioritise work and professional life. When context is ambiguous, lean toward professional rather than personal framing.';
    default:
      return 'Handle all aspects of life — work, personal, family. Use context from the conversation to infer which domain is relevant.';
  }
}

function recommendationGuidance(style: AssistantSettings['recommendation_style']): string {
  switch (style) {
    case 'always_give_options':
      return 'Always present multiple options and let the user decide. Do not pick a favourite.';
    case 'always_recommend_one':
      return 'Always give a single direct recommendation with a clear rationale. Do not hedge or list alternatives unless the user asks.';
    default:
      return 'Recommend one option with a short rationale. Briefly mention any meaningful alternative worth considering, but keep it concise.';
  }
}

function clarificationGuidance(behaviour: AssistantSettings['clarification_behaviour']): string {
  switch (behaviour) {
    case 'always_ask_first':
      return 'Before starting any non-trivial task, ask any clarifying questions needed. Do not proceed until you have enough information.';
    case 'just_execute':
      return 'Execute tasks immediately without asking clarifying questions. Make your best judgement and proceed.';
    default:
      return 'Make a reasonable start on the task and explicitly state any assumptions made so the user can redirect if needed. Do not ask questions before starting.';
  }
}
