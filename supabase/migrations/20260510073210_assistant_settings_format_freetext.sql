-- Convert default_output_format from an enum-constrained column to free text.
-- Also update column defaults to remove em dashes.

ALTER TABLE public.assistant_settings
  DROP CONSTRAINT IF EXISTS assistant_settings_default_output_format_check;

ALTER TABLE public.assistant_settings
  ALTER COLUMN default_output_format SET DEFAULT 'Prose for narrative tasks, bullet points for action items and lists. Always lead with the most important thing.';

ALTER TABLE public.assistant_settings
  ALTER COLUMN voice_and_tone SET DEFAULT 'Business casual, friendly but professional. No corporate fluff.';

ALTER TABLE public.assistant_settings
  ALTER COLUMN things_to_never_say SET DEFAULT 'Avoid filler affirmations (e.g. "Certainly!", "Great question!"). Avoid cliched business phrases. Never use an em dash.';
