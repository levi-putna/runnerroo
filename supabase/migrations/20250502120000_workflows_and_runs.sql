-- Workflows: persisted graph, trigger metadata, and aggregate run stats for listings.
-- workflow_runs: individual executions (populated when the runner exists).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- workflows
-- ---------------------------------------------------------------------------
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled workflow',
  description text,
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual', 'webhook', 'cron')),
  trigger_config jsonb not null default '{}'::jsonb,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('active', 'inactive', 'draft')),
  run_count integer not null default 0 check (run_count >= 0),
  last_run_at timestamptz
);

create index if not exists workflows_user_id_updated_at_idx
  on public.workflows (user_id, updated_at desc);

comment on table public.workflows is 'User-owned workflow definitions (React Flow graph as JSON).';

-- ---------------------------------------------------------------------------
-- workflow_runs
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual', 'webhook', 'cron')),
  error text,
  node_results jsonb not null default '[]'::jsonb
);

create index if not exists workflow_runs_workflow_id_started_at_idx
  on public.workflow_runs (workflow_id, started_at desc);

comment on table public.workflow_runs is 'Per-execution records for a workflow.';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_workflows_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workflows_set_updated_at on public.workflows;
create trigger workflows_set_updated_at
  before update on public.workflows
  for each row
  execute procedure public.set_workflows_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.workflows enable row level security;
alter table public.workflow_runs enable row level security;

create policy "Users can select own workflows"
  on public.workflows for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own workflows"
  on public.workflows for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own workflows"
  on public.workflows for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own workflows"
  on public.workflows for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can select runs for own workflows"
  on public.workflow_runs for select
  to authenticated
  using (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()
    )
  );

create policy "Users can insert runs for own workflows"
  on public.workflow_runs for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()
    )
  );

create policy "Users can update runs for own workflows"
  on public.workflow_runs for update
  to authenticated
  using (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()
    )
  );

create policy "Users can delete runs for own workflows"
  on public.workflow_runs for delete
  to authenticated
  using (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()
    )
  );
