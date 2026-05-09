-- ---------------------------------------------------------------------------
-- Dailify workflow dispatch tick — Supabase Cron → Next.js POST
-- ---------------------------------------------------------------------------
-- **Superseded for new deployments.** Schedule workflows sync their own **`cron.job`** rows via
-- **`dailify_add_or_replace_cron_job`** (migration `20260508000000_dailify_cron_rpc.sql`) → **`POST /api/cron/workflows/{id}`**.
-- Running this legacy template **alongside** per-workflow jobs **double-invokes** the same workflows (minute tick scanner + per-workflow fire).
--
-- Legacy scope: kept only if you deliberately remain on **`POST /api/cron/workflow-schedules`** (minute tick scans all workflows).
--
-- Supabase Cron uses pg_cron (see https://supabase.com/docs/guides/cron).
--
-- This SQL does NOT correspond to publishing a workflow in the Dailify editor — configure this **global** infra job separately.
--
-- Prerequisites (Dashboard → Database → Extensions, or CLI):
--   - pg_cron
--   - pg_net           (provides net.http_post)
--   - supabase_vault   (Vault secrets for URL + Bearer token material)
--
-- One-time Vault secrets (Dashboard → Project Settings → Vault, or vault.create_secret):
--   workflow_cron_dispatch_url     full URL → https://YOUR_HOST/api/cron/workflow-schedules
--   workflow_cron_dispatch_secret  plaintext token only — must MATCH WORKFLOW_CRON_DISPATCH_SECRET
--                                  on the deployed Next.js app (do NOT include a "Bearer " prefix)
--
-- Re-run `cron.schedule` with the SAME job name to replace definitions (Dashboard quickstart notes name upserts).
--
-- Inspect after setup:
--   select jobid, jobname, schedule, active from cron.job where jobname = 'dailify_workflow_dispatch_minute_tick';
--   select * from cron.job_run_details order by start_time desc limit 10;
--

select cron.schedule(
  'dailify_workflow_dispatch_minute_tick',
  '* * * * *',
  $dailify_dispatch$
    select net.http_post(
      url :=
        trim(
          (
            select decrypted_secret::text
            from vault.decrypted_secrets
            where name = 'workflow_cron_dispatch_url'
            order by updated_at desc nulls last
            limit 1
          )
        ),
      headers := jsonb_build_object(
        'Content-Type',
        'application/json',
        'Authorization',
        (
          select 'Bearer '
            || trim(
              (
                select decrypted_secret::text
                from vault.decrypted_secrets
                where name = 'workflow_cron_dispatch_secret'
                order by updated_at desc nulls last
                limit 1
              )
            )
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    ) as request_id;
  $dailify_dispatch$
);
