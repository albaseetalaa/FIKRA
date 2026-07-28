-- Additive project metadata for normalized project context and input payload.

alter table if exists public.projects
add column if not exists metadata_json jsonb not null default '{}'::jsonb;

create index if not exists idx_projects_metadata_json_gin on public.projects using gin (metadata_json);
