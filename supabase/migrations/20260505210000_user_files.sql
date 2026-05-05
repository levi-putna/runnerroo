-- Store user-owned file artefacts persisted in Supabase Storage.

create table if not exists public.user_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  path text not null,
  name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists user_files_user_id_created_at_idx
  on public.user_files (user_id, created_at desc);

create unique index if not exists user_files_bucket_path_idx
  on public.user_files (bucket, path);

comment on table public.user_files is
  'User-owned file artefacts stored in Supabase Storage (documents, templates, and future file outputs).';

alter table public.user_files enable row level security;

create policy "Users can select own files"
  on public.user_files for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own files"
  on public.user_files for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own files"
  on public.user_files for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own files"
  on public.user_files for delete
  to authenticated
  using (auth.uid() = user_id);

-- Private buckets for workflow document assets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'workflow-document-templates',
    'workflow-document-templates',
    false,
    52428800,
    array[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ]
  ),
  (
    'workflow-document-outputs',
    'workflow-document-outputs',
    false,
    52428800,
    array[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/pdf'
    ]
  )
on conflict (id) do nothing;

-- Note: omit COMMENT ON storage.objects columns — migrations run without ownership of Supabase-internal storage tables.

-- Storage object RLS: first folder segment must match auth.uid().
create policy "Users can view own workflow document objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('workflow-document-templates', 'workflow-document-outputs')
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Users can upload own workflow document objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('workflow-document-templates', 'workflow-document-outputs')
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Users can update own workflow document objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('workflow-document-templates', 'workflow-document-outputs')
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id in ('workflow-document-templates', 'workflow-document-outputs')
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "Users can delete own workflow document objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('workflow-document-templates', 'workflow-document-outputs')
    and split_part(name, '/', 1) = auth.uid()::text
  );
