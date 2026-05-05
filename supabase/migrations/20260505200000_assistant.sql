-- =============================================================================
-- Assistant: pgvector extension, conversations, and memories tables
-- =============================================================================

-- Enable pgvector for storing AI embeddings.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- =============================================================================
-- Conversations
-- =============================================================================
CREATE TABLE public.conversations (
  id          TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT 'New conversation',
  messages    JSONB       NOT NULL DEFAULT '[]',
  memories_preview JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT conversations_pkey      PRIMARY KEY (id),
  CONSTRAINT conversations_id_length CHECK (char_length(id) BETWEEN 1 AND 128)
);

CREATE INDEX conversations_user_id_updated_at_idx
  ON public.conversations (user_id, updated_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations: select own"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "conversations: insert own"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations: update own"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "conversations: delete own"
  ON public.conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Keep updated_at current on every write.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER conversations_set_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- Memories
-- =============================================================================
CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  importance REAL NOT NULL DEFAULT 0.7,
  confidence REAL NOT NULL DEFAULT 0.7,
  source TEXT,
  source_message_id TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  embedding extensions.vector(1536) NOT NULL,
  content_fts tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(key, '') || ' ' || coalesce(content, ''))
  ) STORED,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT memories_type_check CHECK (
    type = ANY (
      ARRAY[
        'preference',
        'profile',
        'project',
        'task',
        'temporary',
        'behaviour',
        'technical_context'
      ]
    )
  ),
  CONSTRAINT memories_status_check CHECK (status = ANY (ARRAY['active', 'archived', 'deleted'])),
  CONSTRAINT memories_importance_range CHECK (importance >= 0 AND importance <= 1),
  CONSTRAINT memories_confidence_range CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX memories_embedding_ivfflat_idx
  ON public.memories
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX memories_content_fts_gin_idx
  ON public.memories
  USING gin (content_fts);

CREATE INDEX memories_user_id_idx
  ON public.memories (user_id);

CREATE INDEX memories_user_id_status_idx
  ON public.memories (user_id, status);

CREATE UNIQUE INDEX memories_user_id_key_active_idx
  ON public.memories (user_id, key)
  WHERE status = 'active';

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memories: select own"
  ON public.memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "memories: insert own"
  ON public.memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "memories: update own"
  ON public.memories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "memories: delete own"
  ON public.memories FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER memories_set_updated_at
  BEFORE UPDATE ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.match_memories_hybrid (
  query_text TEXT,
  query_embedding extensions.vector(1536),
  match_count INTEGER DEFAULT 10,
  filter_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  type TEXT,
  key TEXT,
  content TEXT,
  importance REAL,
  confidence REAL,
  source TEXT,
  source_message_id TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB,
  status TEXT,
  usage_count INTEGER,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity_score DOUBLE PRECISION,
  keyword_score DOUBLE PRECISION,
  combined_score DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH params AS (
    SELECT
      LEAST(GREATEST(COALESCE(match_count, 10), 1), 50) AS safe_match_count,
      CASE
        WHEN query_text IS NULL OR length(trim(query_text)) = 0 THEN NULL
        ELSE plainto_tsquery('english', trim(query_text))
      END AS text_query
  ),
  base AS (
    SELECT
      m.id, m.user_id, m.type, m.key, m.content, m.importance, m.confidence,
      m.source, m.source_message_id, m.expires_at, m.metadata, m.status,
      m.usage_count, m.last_used_at, m.created_at, m.updated_at, m.content_fts,
      (m.embedding <=> query_embedding)::double precision AS distance
    FROM public.memories m
    WHERE
      m.user_id = auth.uid()
      AND m.status = 'active'
      AND (m.expires_at IS NULL OR m.expires_at >= NOW())
      AND (filter_types IS NULL OR array_length(filter_types, 1) IS NULL OR m.type = ANY (filter_types))
  ),
  vector_ranked AS (
    SELECT b.id, b.distance, row_number() OVER (ORDER BY b.distance ASC) AS vector_rank
    FROM base b, params p
    ORDER BY b.distance ASC
    LIMIT (SELECT safe_match_count * 10 FROM params)
  ),
  keyword_ranked AS (
    SELECT
      b.id,
      ts_rank_cd(b.content_fts, p.text_query)::double precision AS text_rank,
      row_number() OVER (ORDER BY ts_rank_cd(b.content_fts, p.text_query) DESC, b.updated_at DESC) AS keyword_rank
    FROM base b, params p
    WHERE p.text_query IS NOT NULL AND b.content_fts @@ p.text_query
    ORDER BY ts_rank_cd(b.content_fts, p.text_query) DESC, b.updated_at DESC
    LIMIT (SELECT safe_match_count * 10 FROM params)
  ),
  fused AS (
    SELECT
      COALESCE(v.id, k.id) AS id,
      v.distance,
      k.text_rank,
      CASE WHEN v.vector_rank IS NULL THEN 0 ELSE (1.0 / (60 + v.vector_rank)) END AS vector_rrf,
      CASE WHEN k.keyword_rank IS NULL THEN 0 ELSE (1.0 / (60 + k.keyword_rank)) END AS keyword_rrf
    FROM vector_ranked v
    FULL OUTER JOIN keyword_ranked k ON k.id = v.id
  )
  SELECT
    b.id, b.user_id, b.type, b.key, b.content, b.importance, b.confidence,
    b.source, b.source_message_id, b.expires_at, b.metadata, b.status,
    b.usage_count, b.last_used_at, b.created_at, b.updated_at,
    COALESCE(1 - f.distance, 0)::double precision AS similarity_score,
    COALESCE(f.keyword_rrf, 0)::double precision AS keyword_score,
    (COALESCE(f.vector_rrf, 0) + COALESCE(f.keyword_rrf, 0))::double precision AS combined_score
  FROM fused f
  JOIN base b ON b.id = f.id
  ORDER BY combined_score DESC, b.updated_at DESC
  LIMIT (SELECT safe_match_count FROM params);
$$;

GRANT EXECUTE ON FUNCTION public.match_memories_hybrid (
  TEXT,
  extensions.vector(1536),
  INTEGER,
  TEXT[]
) TO authenticated;
