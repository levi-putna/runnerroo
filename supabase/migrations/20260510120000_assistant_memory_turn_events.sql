-- Append-only audit trail for assistant memory retrieval, review, and tool-driven writes.

CREATE TABLE public.assistant_memory_turn_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES public.conversations (id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (
    kind = ANY (ARRAY['retrieval'::text, 'review'::text, 'tool_write'::text])
  ),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX assistant_memory_turn_events_user_created_at_idx
  ON public.assistant_memory_turn_events (user_id, created_at DESC);

CREATE INDEX assistant_memory_turn_events_conversation_created_at_idx
  ON public.assistant_memory_turn_events (conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE public.assistant_memory_turn_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_memory_turn_events: select own"
  ON public.assistant_memory_turn_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "assistant_memory_turn_events: insert own"
  ON public.assistant_memory_turn_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
