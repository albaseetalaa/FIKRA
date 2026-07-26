-- Durable AI workflow persistence schema
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.projects (
  id text primary key,
  name text not null,
  idea text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  active_pipeline_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  sanitized_error_message text
);

create trigger projects_set_updated_at
before update on public.projects
for each row
execute procedure public.set_updated_at();

create table if not exists public.workflow_runs (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  pipeline_id text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workflow_runs_set_updated_at
before update on public.workflow_runs
for each row
execute procedure public.set_updated_at();

create table if not exists public.workflow_tasks (
  id text primary key,
  workflow_run_id text not null references public.workflow_runs(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  agent_id text not null,
  output_type text,
  provider_id text,
  model text,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  dependency_ids text[] not null default '{}',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workflow_tasks_set_updated_at
before update on public.workflow_tasks
for each row
execute procedure public.set_updated_at();

create table if not exists public.attempts (
  id text primary key,
  task_id text not null references public.workflow_tasks(id) on delete cascade,
  attempt_number integer not null,
  provider_id text,
  model text,
  status text not null check (status in ('running', 'completed', 'failed')),
  error_code text,
  retryable boolean not null default false,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(task_id, attempt_number)
);

create table if not exists public.artifacts (
  id text primary key default gen_random_uuid()::text,
  project_id text not null references public.projects(id) on delete cascade,
  workflow_run_id text references public.workflow_runs(id) on delete set null,
  task_id text references public.workflow_tasks(id) on delete set null,
  agent_id text not null,
  pipeline_id text,
  output_type text not null,
  content_json jsonb not null,
  validation_status text not null check (validation_status in ('valid', 'invalid')),
  schema_version integer not null default 1,
  artifact_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger artifacts_set_updated_at
before update on public.artifacts
for each row
execute procedure public.set_updated_at();

create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_projects_created_at on public.projects(created_at desc);

create index if not exists idx_workflow_runs_project_id on public.workflow_runs(project_id);
create index if not exists idx_workflow_runs_status on public.workflow_runs(status);
create index if not exists idx_workflow_runs_created_at on public.workflow_runs(created_at desc);

create index if not exists idx_workflow_tasks_workflow_run_id on public.workflow_tasks(workflow_run_id);
create index if not exists idx_workflow_tasks_project_id on public.workflow_tasks(project_id);
create index if not exists idx_workflow_tasks_status on public.workflow_tasks(status);
create index if not exists idx_workflow_tasks_created_at on public.workflow_tasks(created_at desc);

create index if not exists idx_attempts_task_id on public.attempts(task_id);
create index if not exists idx_attempts_created_at on public.attempts(created_at desc);
create index if not exists idx_attempts_status on public.attempts(status);

create index if not exists idx_artifacts_project_id on public.artifacts(project_id);
create index if not exists idx_artifacts_workflow_run_id on public.artifacts(workflow_run_id);
create index if not exists idx_artifacts_task_id on public.artifacts(task_id);
create index if not exists idx_artifacts_created_at on public.artifacts(created_at desc);
create index if not exists idx_artifacts_status on public.artifacts(validation_status);
