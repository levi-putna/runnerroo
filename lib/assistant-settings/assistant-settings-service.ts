import type { SupabaseClient } from '@supabase/supabase-js';

import {
  bustAssistantSettingsCache,
  getCachedAssistantSettings,
  setCachedAssistantSettings,
} from './assistant-settings-cache';
import { DEFAULT_ASSISTANT_SETTINGS, type AssistantSettings, type AssistantSettingsPatch } from './types';

/**
 * Fetches the assistant settings for a user.
 *
 * Checks the in-process cache first. On a cache miss, queries Supabase and
 * hydrates the cache. If no row exists yet, returns the default values without
 * writing to the DB (the row is created on first explicit save via {@link upsertAssistantSettings}).
 */
export async function getAssistantSettings({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<AssistantSettings> {
  const cached = getCachedAssistantSettings(userId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('assistant_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('assistant_settings: fetch error', error);
    // Fall back to defaults so the chat turn is never blocked.
    return {
      user_id: userId,
      updated_at: new Date().toISOString(),
      ...DEFAULT_ASSISTANT_SETTINGS,
    };
  }

  if (!data) {
    return {
      user_id: userId,
      updated_at: new Date().toISOString(),
      ...DEFAULT_ASSISTANT_SETTINGS,
    };
  }

  const settings = data as AssistantSettings;
  setCachedAssistantSettings(userId, settings);
  return settings;
}

/**
 * Creates or replaces the assistant settings row for a user, then busts the cache.
 */
export async function upsertAssistantSettings({
  supabase,
  userId,
  patch,
}: {
  supabase: SupabaseClient;
  userId: string;
  patch: AssistantSettingsPatch;
}): Promise<AssistantSettings> {
  const current = await getAssistantSettings({ supabase, userId });

  const merged: AssistantSettings = {
    ...current,
    ...patch,
    user_id: userId,
  };

  const { data, error } = await supabase
    .from('assistant_settings')
    .upsert(
      {
        user_id: userId,
        role: merged.role,
        voice_and_tone: merged.voice_and_tone,
        things_to_never_say: merged.things_to_never_say,
        recommendation_style: merged.recommendation_style,
        default_output_format: merged.default_output_format,
        clarification_behaviour: merged.clarification_behaviour,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`assistant_settings: upsert failed — ${error.message}`);
  }

  bustAssistantSettingsCache(userId);

  const saved = data as AssistantSettings;
  setCachedAssistantSettings(userId, saved);
  return saved;
}
