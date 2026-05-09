-- User-defined workflow constants (key/value strings) surfaced at runtime as {{const.<key>}}.
alter table public.workflows
  add column if not exists workflow_constants jsonb not null default '{}'::jsonb;

comment on column public.workflows.workflow_constants is
  'Author-defined string map merged into each run envelope as workflow_constants; templates resolve {{const.<key>}}.';
