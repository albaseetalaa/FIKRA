-- Additive checkpoint persistence for workflow pause/resume.

create table if not exists public.workflow_checkpoints (
  workflow_run_id text primary key references public.workflow_runs(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  current_task_id text not null,
  workflow_status text not null,
  task_status text not null,
  completed_task_ids text[] not null default '{}',
  pending_task_ids text[] not null default '{}',
  dependency_state jsonb not null default '{}'::jsonb,
  attempt_counters jsonb not null default '{}'::jsonb,
  execution_context jsonb not null default '{}'::jsonb,
  user_input_request jsonb not null,
  request_id text not null,
  checkpoint_version integer not null default 1,
  request_consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workflow_checkpoints_set_updated_at
before update on public.workflow_checkpoints
for each row
execute procedure public.set_updated_at();

create index if not exists idx_workflow_checkpoints_project_id on public.workflow_checkpoints(project_id);
create index if not exists idx_workflow_checkpoints_request_id on public.workflow_checkpoints(request_id);
create index if not exists idx_workflow_checkpoints_status on public.workflow_checkpoints(workflow_status);
