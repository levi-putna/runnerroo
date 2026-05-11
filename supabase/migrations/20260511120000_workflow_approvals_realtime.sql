-- Realtime Broadcast for workflow_approvals: private topic per reviewer user_id with RLS on realtime.messages.

-- Allow authenticated users to receive broadcast payloads only on their own approvals topic.
drop policy if exists "workflow_approvals realtime: select own" on realtime.messages;

create policy "workflow_approvals realtime: select own"
  on realtime.messages
  for select
  to authenticated
  using (realtime.topic() = 'approvals:' || auth.uid()::text);

-- Notify Realtime when approval rows change (INSERT / UPDATE / DELETE).
create or replace function public.broadcast_workflow_approval_changes()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  perform realtime.broadcast_changes(
    'approvals:' || (
      case
        when tg_op = 'DELETE' then old.user_id
        else new.user_id
      end
    )::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

drop trigger if exists workflow_approvals_broadcast_changes on public.workflow_approvals;

create trigger workflow_approvals_broadcast_changes
  after insert or update or delete on public.workflow_approvals
  for each row
  execute procedure public.broadcast_workflow_approval_changes();
