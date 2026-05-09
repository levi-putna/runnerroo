-- RPC wrappers for pg_cron + pg_net — called only from Runnerroo with service_role (see lib/workflows/sync-runnerroo-pg-cron.ts).

-- Supabase Cron: `cron.job` only exists after pg_cron is enabled (fresh local DB ships without it).
-- https://supabase.com/docs/guides/cron/install
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Command strings scheduled via cron.schedule invoke net.http_post.
-- https://supabase.com/docs/guides/database/extensions/pg_net
create extension if not exists pg_net;

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

create or replace function public.runnerroo_remove_cron_job(p_job_name text) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_job_name is null or length(trim(p_job_name)) = 0 then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = trim(p_job_name)) then
    perform cron.unschedule(trim(p_job_name));
  end if;
end;
$$;

create or replace function public.runnerroo_list_runnerroo_cron_jobs()
returns table (jobid bigint, jobname text, schedule text, active boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select j.jobid, j.jobname, j.schedule, j.active
  from cron.job j
  where j.jobname like 'runnerroo\_wf\_%' escape '\'
  order by j.jobid asc;
$$;

revoke execute on function public.runnerroo_add_or_replace_cron_job(text, text, text, text) from public;
revoke execute on function public.runnerroo_remove_cron_job(text) from public;
revoke execute on function public.runnerroo_list_runnerroo_cron_jobs() from public;
revoke execute on function public.runnerroo_add_or_replace_cron_job(text, text, text, text) from anon;
revoke execute on function public.runnerroo_remove_cron_job(text) from anon;
revoke execute on function public.runnerroo_list_runnerroo_cron_jobs() from anon;
revoke execute on function public.runnerroo_add_or_replace_cron_job(text, text, text, text) from authenticated;
revoke execute on function public.runnerroo_remove_cron_job(text) from authenticated;
revoke execute on function public.runnerroo_list_runnerroo_cron_jobs() from authenticated;

grant execute on function public.runnerroo_add_or_replace_cron_job(text, text, text, text) to service_role;
grant execute on function public.runnerroo_remove_cron_job(text) to service_role;
grant execute on function public.runnerroo_list_runnerroo_cron_jobs() to service_role;
