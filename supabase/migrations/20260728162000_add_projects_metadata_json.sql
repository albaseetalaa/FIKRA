-- Add metadata_json for persistent project input/context snapshots.
alter table if exists public.projects
add column if not exists metadata_json jsonb not null default '{}'::jsonb;
