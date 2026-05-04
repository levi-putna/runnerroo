-- Persisted graph format version: bump when the JSON shape expected by the editor/runner changes.
-- wdk_run_id: correlates a workflow_runs row with a Vercel Workflow DevKit durable run once execution is implemented.

alter table public.workflows
  add column if not exists graph_version integer not null default 1;

alter table public.workflow_runs
  add column if not exists wdk_run_id text;

comment on column public.workflows.graph_version is
  'Version of the persisted nodes/edges JSON; runners should validate before execution.';

comment on column public.workflow_runs.wdk_run_id is
  'Opaque durable run identifier from the workflow runtime (e.g. Vercel Workflow DevKit), when populated.';
