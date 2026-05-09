-- Tighten runnerroo_add_or_replace_cron_job URLs.
--
-- Supabase Cron "HTTP Request" UI jobs and programmatic jobs that run
--   SELECT net.http_post(...)
-- from pg_cron are the same mechanism: pg_net outbound HTTP from Postgres.
-- Postgres cannot reach localhost on your laptop — registrations must use a public https origin.

create or replace function public.runnerroo_add_or_replace_cron_job(
  p_job_name text,
  p_schedule text,
  p_url text,
  p_bearer_secret text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_headers jsonb;
  v_command text;
  v_lc text;
  host_match text[];
begin
  if p_job_name is null or length(trim(p_job_name)) = 0 then
    raise exception 'runnerroo_add_or_replace_cron_job: empty job_name';
  end if;
  if p_schedule is null or length(trim(p_schedule)) = 0 then
    raise exception 'runnerroo_add_or_replace_cron_job: empty schedule';
  end if;
  if p_url is null or length(trim(p_url)) = 0 then
    raise exception 'runnerroo_add_or_replace_cron_job: empty url';
  end if;

  v_lc := lower(trim(p_url));
  if v_lc not like 'https://%' then
    raise exception
      'runnerroo_add_or_replace_cron_job: url must begin with https:// — Supabase Cron uses pg_net from the database host and needs a reachable TLS endpoint (Supabase Cron quickstart).';
  end if;

  host_match := regexp_match(v_lc, '^https://([^/:?]+)');
  if host_match is null or trim(coalesce(host_match[1], '')) = '' then
    raise exception 'runnerroo_add_or_replace_cron_job: could not parse hostname from url';
  end if;
  if lower(trim(host_match[1])) in ('localhost', '127.0.0.1', '[::1]') then
    raise exception 'runnerroo_add_or_replace_cron_job: hostname must not be localhost — pg_net cannot reach your machine; use WORKFLOW_CRON_PUBLIC_BASE_URL to a deployed https origin.';
  end if;

  v_headers := jsonb_build_object(
    'Content-Type',
    'application/json',
    'Authorization',
    'Bearer ' || p_bearer_secret
  );

  v_command := format(
    'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb, timeout_milliseconds := 25000);',
    trim(p_url),
    v_headers::text
  );

  perform cron.schedule(trim(p_job_name), trim(p_schedule), v_command);
end;
$$;
