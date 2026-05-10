import { NextResponse } from 'next/server';

import {
  getAssistantSettings,
  upsertAssistantSettings,
} from '@/lib/assistant-settings/assistant-settings-service';
import {
  ASSISTANT_ROLES,
  CLARIFICATION_BEHAVIOURS,
  RECOMMENDATION_STYLES,
  type AssistantSettingsPatch,
} from '@/lib/assistant-settings/types';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/assistant-settings
 * Returns the current assistant settings for the authenticated user.
 * Falls back to defaults if no row exists yet.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const settings = await getAssistantSettings({ supabase, userId: user.id });
  return NextResponse.json(settings);
}

/**
 * PATCH /api/assistant-settings
 * Updates one or more assistant settings fields for the authenticated user.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch: AssistantSettingsPatch = {};

  if ('role' in body) {
    if (!(ASSISTANT_ROLES as readonly string[]).includes(body.role as string)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${ASSISTANT_ROLES.join(', ')}` },
        { status: 400 }
      );
    }
    patch.role = body.role as AssistantSettingsPatch['role'];
  }

  if ('voice_and_tone' in body) {
    if (typeof body.voice_and_tone !== 'string' || !body.voice_and_tone.trim()) {
      return NextResponse.json({ error: 'voice_and_tone must be a non-empty string' }, { status: 400 });
    }
    if (body.voice_and_tone.length > 250) {
      return NextResponse.json({ error: 'voice_and_tone must be 250 characters or fewer' }, { status: 400 });
    }
    patch.voice_and_tone = body.voice_and_tone.trim();
  }

  if ('things_to_never_say' in body) {
    if (typeof body.things_to_never_say !== 'string') {
      return NextResponse.json({ error: 'things_to_never_say must be a string' }, { status: 400 });
    }
    if (body.things_to_never_say.length > 250) {
      return NextResponse.json({ error: 'things_to_never_say must be 250 characters or fewer' }, { status: 400 });
    }
    patch.things_to_never_say = body.things_to_never_say.trim();
  }

  if ('recommendation_style' in body) {
    if (!(RECOMMENDATION_STYLES as readonly string[]).includes(body.recommendation_style as string)) {
      return NextResponse.json(
        { error: `Invalid recommendation_style. Must be one of: ${RECOMMENDATION_STYLES.join(', ')}` },
        { status: 400 }
      );
    }
    patch.recommendation_style = body.recommendation_style as AssistantSettingsPatch['recommendation_style'];
  }

  if ('default_output_format' in body) {
    if (typeof body.default_output_format !== 'string') {
      return NextResponse.json({ error: 'default_output_format must be a string' }, { status: 400 });
    }
    if (body.default_output_format.length > 250) {
      return NextResponse.json({ error: 'default_output_format must be 250 characters or fewer' }, { status: 400 });
    }
    patch.default_output_format = body.default_output_format.trim();
  }

  if ('clarification_behaviour' in body) {
    if (!(CLARIFICATION_BEHAVIOURS as readonly string[]).includes(body.clarification_behaviour as string)) {
      return NextResponse.json(
        { error: `Invalid clarification_behaviour. Must be one of: ${CLARIFICATION_BEHAVIOURS.join(', ')}` },
        { status: 400 }
      );
    }
    patch.clarification_behaviour = body.clarification_behaviour as AssistantSettingsPatch['clarification_behaviour'];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  try {
    const settings = await upsertAssistantSettings({ supabase, userId: user.id, patch });
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
