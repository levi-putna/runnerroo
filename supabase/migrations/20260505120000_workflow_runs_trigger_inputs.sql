-- Persist manual (and future) trigger payloads on each run for history / replay context.

alter table public.workflow_runs
  add column if not exists trigger_inputs jsonb;

comment on column public.workflow_runs.trigger_inputs is
  'Snapshot of trigger payload (e.g. manual form values) at run start.';
