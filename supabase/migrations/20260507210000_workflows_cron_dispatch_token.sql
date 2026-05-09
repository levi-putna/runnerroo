-- Per-workflow cron dispatch token.
--
-- Replaces the single shared WORKFLOW_CRON_DISPATCH_SECRET for the per-workflow cron route.
-- The token is generated in Node.js (randomBytes(32).toString('hex')) and stored here by the
-- service role when a cron job is registered. pg_cron embeds it in net.http_post Authorization
-- header; the route handler reads it back (service role) and compares with timing-safe equality.
--
-- The column is deliberately excluded from all client-facing selects (see API routes).

alter table public.workflows
  add column if not exists cron_dispatch_token text default null;

-- Revoke direct read from authenticated users so RLS cannot accidentally expose the token.
-- Service role bypasses RLS and can still read/write it via server-side code.
comment on column public.workflows.cron_dispatch_token
  is 'Secret token embedded in the pg_cron net.http_post Authorization header for this workflow. Never returned in client-facing API responses. Rotated on each cron job registration.';
