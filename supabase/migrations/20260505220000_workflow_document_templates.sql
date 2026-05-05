-- Metadata table for document templates referenced by workflow document steps.

create table if not exists public.workflow_document_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workflow_id uuid references public.workflows (id) on delete set null,
  name text not null,
  bucket text not null default 'workflow-document-templates',
  path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists workflow_document_templates_user_id_updated_at_idx
  on public.workflow_document_templates (user_id, updated_at desc);

create index if not exists workflow_document_templates_workflow_id_idx
  on public.workflow_document_templates (workflow_id);

create unique index if not exists workflow_document_templates_bucket_path_idx
  on public.workflow_document_templates (bucket, path);

comment on table public.workflow_document_templates is
  'User-owned template registry for workflow document generation steps.';

create or replace function public.set_workflow_document_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workflow_document_templates_set_updated_at on public.workflow_document_templates;
create trigger workflow_document_templates_set_updated_at
  before update on public.workflow_document_templates
  for each row
  execute procedure public.set_workflow_document_templates_updated_at();

alter table public.workflow_document_templates enable row level security;

create policy "Users can select own workflow document templates"
  on public.workflow_document_templates for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own workflow document templates"
  on public.workflow_document_templates for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own workflow document templates"
  on public.workflow_document_templates for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own workflow document templates"
  on public.workflow_document_templates for delete
  to authenticated
  using (auth.uid() = user_id);
