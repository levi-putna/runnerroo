-- Optional copy for operators: what to check before approving (surfaced in Inbox).

alter table public.workflow_approvals
  add column if not exists reviewer_instructions text;

comment on column public.workflow_approvals.reviewer_instructions is
  'Author-defined guidance shown to the reviewer in Inbox (from the approval step).';
