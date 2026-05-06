-- Human-in-the-loop approvals: pause runs until operator approves or declines.

-- Extend run status when paused on an approval step.
alter table public.workflow_runs
  drop constraint if exists workflow_runs_status_check;

alter table public.workflow_runs
  add constraint workflow_runs_status_check
  check (
    status in ('running', 'success', 'failed', 'cancelled', 'waiting_approval')
  );

-- ---------------------------------------------------------------------------
-- workflow_approvals
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_approvals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workflow_run_id uuid not null references public.workflow_runs (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  node_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  title text not null default '',
  description text,
  step_input jsonb not null default '{}'::jsonb,
  step_output jsonb,
  responded_at timestamptz,
  responded_by uuid references auth.users (id) on delete set null
);

create index if not exists workflow_approvals_user_id_status_created_at_idx
  on public.workflow_approvals (user_id, status, created_at desc);

create index if not exists workflow_approvals_workflow_run_id_idx
  on public.workflow_approvals (workflow_run_id);

comment on table public.workflow_approvals is 'Operator approval checkpoints for paused workflow runs.';

-- Keep updated_at in sync when rows are mutated.
drop trigger if exists workflow_approvals_set_updated_at on public.workflow_approvals;
create trigger workflow_approvals_set_updated_at
  before update on public.workflow_approvals
  for each row execute procedure public.set_workflows_updated_at();

-- Reuse workflows updated_at helper (same semantics: touch updated_at on update).

alter table public.workflow_approvals enable row level security;

create policy "Users can select own workflow approvals"
  on public.workflow_approvals for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own workflow approvals"
  on public.workflow_approvals for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own workflow approvals"
  on public.workflow_approvals for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own workflow approvals"
  on public.workflow_approvals for delete
  to authenticated
  using (auth.uid() = user_id);
