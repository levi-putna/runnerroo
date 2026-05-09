-- Rebrand pg_cron RPCs from runnerroo_* to dailify_* and retire legacy job names.
-- Unschedules runnerroo_wf_* and runnerroo_workflow_dispatch_minute_tick so the app can re-register via dailify_wf_* on the next workflow save.

do $$
declare
  r record;
begin
  for r in
    select jobname
    from cron.job
    where jobname like 'runnerroo\_wf\_%' escape '\'
       or jobname = 'runnerroo_workflow_dispatch_minute_tick'
  loop
    perform cron.unschedule(r.jobname);
  end loop;
end $$;

drop function if exists public.runnerroo_add_or_replace_cron_job(text, text, text, text);
drop function if exists public.runnerroo_remove_cron_job(text);
drop function if exists public.runnerroo_list_runnerroo_cron_jobs();

-- Allow http URLs for reachable non-local deployments (HTTPS still preferred).
-- Matches Node-side pgNetCronDispatchUrlIssue (https or http, never localhost).

create or replace function public.dailify_add_or_replace_cron_job(
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
    raise exception 'dailify_add_or_replace_cron_job: empty job_name';
  end if;
  if p_schedule is null or length(trim(p_schedule)) = 0 then
    raise exception 'dailify_add_or_replace_cron_job: empty schedule';
  end if;
  if p_url is null or length(trim(p_url)) = 0 then
    raise exception 'dailify_add_or_replace_cron_job: empty url';
  end if;

  v_lc := lower(trim(p_url));
  if v_lc not like 'https://%' and v_lc not like 'http://%' then
    raise exception
      'dailify_add_or_replace_cron_job: url must begin with https:// or http:// — pg_net rejects other schemes.';
  end if;

  host_match := regexp_match(v_lc, '^https?://([^/:?]+)');
  if host_match is null or trim(coalesce(host_match[1], '')) = '' then
    raise exception 'dailify_add_or_replace_cron_job: could not parse hostname from url';
  end if;
  if lower(trim(host_match[1])) in ('localhost', '127.0.0.1', '[::1]') then
    raise exception 'dailify_add_or_replace_cron_job: hostname must not be localhost — pg_net cannot reach your machine; set WORKFLOW_CRON_PUBLIC_BASE_URL to a deployed origin.';
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

create or replace function public.dailify_remove_cron_job(p_job_name text) returns void
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

create or replace function public.dailify_list_dailify_cron_jobs()
returns table (jobid bigint, jobname text, schedule text, active boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select j.jobid, j.jobname, j.schedule, j.active
  from cron.job j
  where j.jobname like 'dailify\_wf\_%' escape '\'
  order by j.jobid asc;
$$;

revoke execute on function public.dailify_add_or_replace_cron_job(text, text, text, text) from public;
revoke execute on function public.dailify_remove_cron_job(text) from public;
revoke execute on function public.dailify_list_dailify_cron_jobs() from public;
revoke execute on function public.dailify_add_or_replace_cron_job(text, text, text, text) from anon;
revoke execute on function public.dailify_remove_cron_job(text) from anon;
revoke execute on function public.dailify_list_dailify_cron_jobs() from anon;
revoke execute on function public.dailify_add_or_replace_cron_job(text, text, text, text) from authenticated;
revoke execute on function public.dailify_remove_cron_job(text) from authenticated;
revoke execute on function public.dailify_list_dailify_cron_jobs() from authenticated;

grant execute on function public.dailify_add_or_replace_cron_job(text, text, text, text) to service_role;
grant execute on function public.dailify_remove_cron_job(text) to service_role;
grant execute on function public.dailify_list_dailify_cron_jobs() to service_role;
