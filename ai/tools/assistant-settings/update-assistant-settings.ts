import type { SupabaseClient } from '@supabase/supabase-js';
import { tool } from 'ai';
import { z } from 'zod';

import { upsertAssistantSettings } from '@/lib/assistant-settings/assistant-settings-service';
import {
  ASSISTANT_ROLES,
  ASSISTANT_ROLE_LABELS,
  CLARIFICATION_BEHAVIOURS,
  CLARIFICATION_BEHAVIOUR_LABELS,
  RECOMMENDATION_STYLES,
  RECOMMENDATION_STYLE_LABELS,
} from '@/lib/assistant-settings/types';

/**
 * Builds a tool that lets the assistant update one or more of the user's assistant
 * settings on their behalf. Only fields explicitly provided in the call are changed —
 * omitted fields are left at their current values.
 *
 * The cache is automatically busted inside {@link upsertAssistantSettings} so the
 * updated settings take effect from the next chat turn.
 */
export function createUpdateAssistantSettingsTool({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const roleOptions = ASSISTANT_ROLES.map((r) => `${r} (${ASSISTANT_ROLE_LABELS[r]})`).join(', ');
  const recommendationOptions = RECOMMENDATION_STYLES.map(
    (s) => `${s} (${RECOMMENDATION_STYLE_LABELS[s]})`
  ).join(', ');
  const clarificationOptions = CLARIFICATION_BEHAVIOURS.map(
    (b) => `${b} (${CLARIFICATION_BEHAVIOUR_LABELS[b]})`
  ).join(', ');

  return tool({
    description: `Update one or more of the user's assistant behaviour settings. Only include fields the user has explicitly asked to change. Settings take effect from the next message.`,
    inputSchema: z.object({
      role: z
        .enum(ASSISTANT_ROLES)
        .optional()
        .describe(`Primary assistant function. Options: ${roleOptions}.`),
      voice_and_tone: z
        .string()
        .optional()
        .describe('Free-text description of how the assistant should write and speak.'),
      things_to_never_say: z
        .string()
        .optional()
        .describe('Words, phrases, or patterns the assistant must never use. Comma or newline separated.'),
      recommendation_style: z
        .enum(RECOMMENDATION_STYLES)
        .optional()
        .describe(`How the assistant delivers recommendations. Options: ${recommendationOptions}.`),
      default_output_format: z
        .string()
        .max(250)
        .optional()
        .describe('Free-text description of preferred response structure (max 250 characters). e.g. "Prose for narrative, bullets for action items. Always lead with the answer."'),
      clarification_behaviour: z
        .enum(CLARIFICATION_BEHAVIOURS)
        .optional()
        .describe(`Whether to ask clarifying questions or proceed with assumptions. Options: ${clarificationOptions}.`),
    }),
    execute: async ({
      role,
      voice_and_tone,
      things_to_never_say,
      recommendation_style,
      default_output_format,
      clarification_behaviour,
    }) => {
      const patch = {
        ...(role !== undefined ? { role } : {}),
        ...(voice_and_tone !== undefined ? { voice_and_tone } : {}),
        ...(things_to_never_say !== undefined ? { things_to_never_say } : {}),
        ...(recommendation_style !== undefined ? { recommendation_style } : {}),
        ...(default_output_format !== undefined ? { default_output_format } : {}),
        ...(clarification_behaviour !== undefined ? { clarification_behaviour } : {}),
      };

      const updated = await upsertAssistantSettings({ supabase, userId, patch });

      return {
        updated: true,
        settings: {
          role: updated.role,
          voice_and_tone: updated.voice_and_tone,
          things_to_never_say: updated.things_to_never_say,
          recommendation_style: updated.recommendation_style,
          default_output_format: updated.default_output_format,
          clarification_behaviour: updated.clarification_behaviour,
        },
      };
    },
  });
}
