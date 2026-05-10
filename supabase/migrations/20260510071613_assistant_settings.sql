-- Per-user assistant behaviour settings, referenced on every chat turn via the system prompt.

CREATE TABLE public.assistant_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,

  -- The primary function of the assistant.
  role TEXT NOT NULL DEFAULT 'general_assistant'
    CHECK (role = ANY (ARRAY['general_assistant', 'personal_assistant', 'executive_assistant'])),

  -- How the assistant writes and speaks.
  voice_and_tone TEXT NOT NULL DEFAULT 'Business casual — friendly but professional, no corporate fluff.',

  -- Words, phrases, or patterns to filter out automatically.
  things_to_never_say TEXT NOT NULL DEFAULT 'Avoid filler affirmations (e.g. "Certainly!", "Great question!"). Avoid clichéd business phrases. Never use an em dash (—).',

  -- Whether to present options or give a direct recommendation.
  recommendation_style TEXT NOT NULL DEFAULT 'recommend_one_with_alternatives'
    CHECK (recommendation_style = ANY (ARRAY['always_give_options', 'always_recommend_one', 'recommend_one_with_alternatives'])),

  -- Preferred structure for responses.
  default_output_format TEXT NOT NULL DEFAULT 'prose_and_bullets'
    CHECK (default_output_format = ANY (ARRAY['flowing_prose', 'bullet_points', 'headers_and_sections', 'executive_summary_first', 'table_for_comparisons', 'prose_and_bullets'])),

  -- Whether to ask clarifying questions before starting a task.
  clarification_behaviour TEXT NOT NULL DEFAULT 'assume_and_note'
    CHECK (clarification_behaviour = ANY (ARRAY['always_ask_first', 'assume_and_note', 'just_execute'])),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatically refresh updated_at on every write.
CREATE OR REPLACE FUNCTION public.set_assistant_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER assistant_settings_updated_at
  BEFORE UPDATE ON public.assistant_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_assistant_settings_updated_at();

ALTER TABLE public.assistant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_settings: select own"
  ON public.assistant_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "assistant_settings: insert own"
  ON public.assistant_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assistant_settings: update own"
  ON public.assistant_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assistant_settings: delete own"
  ON public.assistant_settings FOR DELETE
  USING (auth.uid() = user_id);
