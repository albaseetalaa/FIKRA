-- Phase A: additive tenant-ownership schema (PR1 / Stage 1).
-- No RLS, no backfill, no NOT NULL enforcement.
-- Safe against a non-empty `projects` table: every new column is nullable
-- and every new constraint on `projects` is added NOT VALID.
--
-- This is a versioned, one-time migration for objects that must not
-- already exist. It deliberately does not use IF NOT EXISTS, DROP IF
-- EXISTS, or CREATE OR REPLACE FUNCTION for anything new below — any
-- conflict with existing schema must fail loudly, not be silently
-- tolerated.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  is_personal boolean not null default false,
  personal_owner_user_id uuid references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_personal_owner_consistency check (
    (is_personal and personal_owner_user_id is not null)
    or (not is_personal and personal_owner_user_id is null)
  )
);

create unique index organizations_personal_owner_user_id_key
  on public.organizations (personal_owner_user_id)
  where personal_owner_user_id is not null;

create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute procedure public.set_updated_at();

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Only idx_organization_memberships_user_id is added: the UNIQUE
-- (organization_id, user_id) constraint above already provides a btree
-- index whose leading column is organization_id, which Postgres can use
-- directly for organization_id-only lookups — a separate single-column
-- index on organization_id would be redundant. No query pattern in this
-- PR looks up memberships by user_id via that composite index (user_id
-- is the trailing column, not independently useful for that), so this
-- index is added for the "find this user's memberships" access path
-- create_project() itself needs.
create index idx_organization_memberships_user_id
  on public.organization_memberships(user_id);

alter table public.projects
  add column organization_id uuid,
  add column created_by uuid;

alter table public.projects
  add constraint projects_organization_id_fkey
  foreign key (organization_id) references public.organizations(id)
  on delete restrict
  not valid;

alter table public.projects
  add constraint projects_created_by_fkey
  foreign key (created_by) references auth.users(id)
  on delete set null
  not valid;

create index idx_projects_organization_id on public.projects(organization_id);
create index idx_projects_created_by on public.projects(created_by);

-- Immutability of tenant-identity columns.
--   organization_id: write-once. Once non-null, it can never change,
--     including becoming null again (its FK is ON DELETE RESTRICT, so no
--     legitimate referential action ever nulls it).
--   created_by: non-reassignable but nullifiable. Once non-null, it may
--     become null (required for the created_by FK's ON DELETE SET NULL
--     action to succeed when that user's auth.users row is deleted), but
--     it may never change to a *different* non-null user id.
create function public.prevent_project_tenant_reassignment()
returns trigger
language plpgsql
as $$
begin
  if old.organization_id is not null and new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is non-reassignable once set on projects.%', old.id;
  end if;

  if old.created_by is not null and new.created_by is not null
     and new.created_by is distinct from old.created_by then
    raise exception 'created_by is non-reassignable to a different user on projects.%', old.id;
  end if;

  return new;
end;
$$;

create trigger projects_prevent_tenant_reassignment
before update on public.projects
for each row
execute procedure public.prevent_project_tenant_reassignment();

-- Single, atomic, public project-creation entry point. This is the only
-- SECURITY DEFINER function in this migration granted to authenticated,
-- and the only RPC exposed for tenant provisioning: personal-organization
-- resolution (uniqueness-safe via the partial unique index above, using
-- the same INSERT ... ON CONFLICT DO NOTHING / fallback SELECT pattern
-- that a standalone helper would use) and owner-membership provisioning
-- are inlined below rather than exposed as a separately callable RPC, so
-- there is exactly one authenticated-reachable entry point for all of it.
--
-- Every system-controlled field (project id, workflow_run id,
-- organization_id, created_by, status, pipeline_id, active_pipeline_id)
-- is set internally; only genuine business-input fields are accepted as
-- individually typed parameters (no free-form JSON), and every argument
-- is validated as caller-controlled input. Limits below are technical
-- resource-abuse guards, not product-content limits.
--
-- Matches the existing application's createProject() contract exactly:
-- one call creates both the project and its initial queued workflow_run,
-- as a single database transaction (a single top-level function call is
-- atomic — any exception anywhere below rolls back everything this call
-- has done so far, including the organization/membership provisioning).
create function public.create_project(
  p_idea text,
  p_business_name text default null,
  p_industry text default null,
  p_country text default null,
  p_city text default null,
  p_stage text default null,
  p_audience text default null,
  p_age_range text default null,
  p_customer_type text default null,
  p_goals text[] default null,
  p_budget text default null,
  p_timeline text default null,
  p_currency text default null
)
returns table (project_id text, organization_id uuid, workflow_run_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_project_id text;
  v_workflow_run_id text;
  v_idea text;
  v_business_name text;
  v_name text;
  v_goals_count int;
  v_goal text;
  v_goals jsonb;
  v_metadata jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  v_idea := btrim(coalesce(p_idea, ''));
  if length(v_idea) < 10 then
    raise exception 'idea must be at least 10 characters.' using errcode = '22023';
  end if;
  if length(v_idea) > 5000 then
    raise exception 'idea must be at most 5000 characters.' using errcode = '22023';
  end if;

  -- businessName: NULL means "not provided" (fallback allowed). A
  -- supplied-but-blank value is rejected, not silently treated as absent.
  if p_business_name is not null then
    v_business_name := btrim(p_business_name);
    if v_business_name = '' then
      raise exception 'businessName must not be blank.' using errcode = '22023';
    end if;
    if length(v_business_name) > 120 then
      raise exception 'businessName must be at most 120 characters.' using errcode = '22023';
    end if;
  else
    v_business_name := null;
  end if;

  if v_business_name is not null then
    v_name := v_business_name;
  else
    -- System-computed fallback (user supplied no name), not user-declared
    -- input — capped to the same 120-char bound the column requires
    -- either way, rather than left unbounded. Splits on the same
    -- whitespace class as the TypeScript buildProjectName()
    -- (idea.trim().split(/\s+/).slice(0, 6).join(" ")): regexp_split_to_array
    -- with '\s+' matches one-or-more whitespace characters (space, tab,
    -- newline, etc.), so repeated/mixed whitespace produces the same
    -- fallback name as the TS implementation, unlike a plain
    -- single-space string_to_array split.
    v_name := left(
      coalesce(nullif(array_to_string((regexp_split_to_array(v_idea, '\s+'))[1:6], ' '), ''), 'New Project'),
      120
    );
  end if;

  if p_industry is not null and length(btrim(p_industry)) > 1000 then
    raise exception 'industry must be at most 1000 characters.' using errcode = '22023';
  end if;
  if p_country is not null and length(btrim(p_country)) > 1000 then
    raise exception 'country must be at most 1000 characters.' using errcode = '22023';
  end if;
  if p_city is not null and length(btrim(p_city)) > 1000 then
    raise exception 'city must be at most 1000 characters.' using errcode = '22023';
  end if;
  if p_stage is not null and length(btrim(p_stage)) > 1000 then
    raise exception 'stage must be at most 1000 characters.' using errcode = '22023';
  end if;
  if p_audience is not null and length(btrim(p_audience)) > 1000 then
    raise exception 'audience must be at most 1000 characters.' using errcode = '22023';
  end if;
  if p_age_range is not null and length(btrim(p_age_range)) > 1000 then
    raise exception 'ageRange must be at most 1000 characters.' using errcode = '22023';
  end if;
  if p_customer_type is not null and length(btrim(p_customer_type)) > 1000 then
    raise exception 'customerType must be at most 1000 characters.' using errcode = '22023';
  end if;
  if p_budget is not null and length(btrim(p_budget)) > 1000 then
    raise exception 'budget must be at most 1000 characters.' using errcode = '22023';
  end if;
  if p_timeline is not null and length(btrim(p_timeline)) > 1000 then
    raise exception 'timeline must be at most 1000 characters.' using errcode = '22023';
  end if;
  if p_currency is not null and length(btrim(p_currency)) > 1000 then
    raise exception 'currency must be at most 1000 characters.' using errcode = '22023';
  end if;

  if p_goals is not null and array_ndims(p_goals) <> 1 then
    raise exception 'goals must be a one-dimensional array.' using errcode = '22023';
  end if;

  v_goals_count := coalesce(array_length(p_goals, 1), 0);
  if v_goals_count > 20 then
    raise exception 'goals may contain at most 20 items.' using errcode = '22023';
  end if;
  for i in 1 .. v_goals_count loop
    v_goal := btrim(coalesce(p_goals[i], ''));
    if v_goal = '' then
      raise exception 'goals items must not be blank.' using errcode = '22023';
    end if;
    if length(v_goal) > 500 then
      raise exception 'each goals item must be at most 500 characters.' using errcode = '22023';
    end if;
  end loop;
  select coalesce(jsonb_agg(btrim(g)), '[]'::jsonb) into v_goals from unnest(p_goals) as g;

  v_metadata := jsonb_build_object(
    'businessName', v_business_name,
    'industry',     nullif(btrim(coalesce(p_industry, '')), ''),
    'country',      nullif(btrim(coalesce(p_country, '')), ''),
    'city',         nullif(btrim(coalesce(p_city, '')), ''),
    'stage',        nullif(btrim(coalesce(p_stage, '')), ''),
    'audience',     nullif(btrim(coalesce(p_audience, '')), ''),
    'ageRange',     nullif(btrim(coalesce(p_age_range, '')), ''),
    'customerType', nullif(btrim(coalesce(p_customer_type, '')), ''),
    'goals',        v_goals,
    'budget',       nullif(btrim(coalesce(p_budget, '')), ''),
    'timeline',     nullif(btrim(coalesce(p_timeline, '')), ''),
    'currency',     nullif(btrim(coalesce(p_currency, '')), '')
  );

  -- Always a JSON object by construction (jsonb_build_object); bounded to
  -- 32KB serialized (byte size), independent of the character-count
  -- limits enforced per field above.
  if octet_length(v_metadata::text) > 32768 then
    raise exception 'metadata exceeds the maximum size of 32KB.' using errcode = '22023';
  end if;

  -- Inlined personal-organization resolution (uniqueness-safe via the
  -- partial unique index on personal_owner_user_id): insert-or-find the
  -- caller's personal organization, then ensure their owner membership.
  -- Both inserts use ON CONFLICT DO NOTHING against real unique
  -- constraints, so concurrent calls for the same user converge on one
  -- organization and one membership row rather than racing.
  insert into public.organizations (personal_owner_user_id, is_personal, created_by, name)
  values (v_uid, true, v_uid, 'Personal')
  on conflict (personal_owner_user_id) where personal_owner_user_id is not null do nothing
  returning id into v_org_id;

  if v_org_id is null then
    select id into v_org_id
    from public.organizations
    where personal_owner_user_id = v_uid;
  end if;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (v_org_id, v_uid, 'owner')
  on conflict (organization_id, user_id) do nothing;

  v_project_id := 'proj_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.projects (
    id, name, idea, status, active_pipeline_id, metadata_json,
    organization_id, created_by
  )
  values (
    v_project_id, v_name, v_idea, 'queued', 'ceo_orchestrated',
    v_metadata, v_org_id, v_uid
  );

  -- Preserves the existing application contract: project creation always
  -- creates its initial queued workflow_run in the same call/transaction,
  -- never as a later, separate service-role write.
  v_workflow_run_id := 'run_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.workflow_runs (id, project_id, pipeline_id, status, progress)
  values (v_workflow_run_id, v_project_id, 'ceo_orchestrated', 'queued', 0);

  return query select v_project_id, v_org_id, v_workflow_run_id;
end;
$$;

revoke execute on function public.create_project(
  text, text, text, text, text, text, text, text, text, text[], text, text, text
) from public, anon, authenticated;
grant execute on function public.create_project(
  text, text, text, text, text, text, text, text, text, text[], text, text, text
) to authenticated;

revoke execute on function public.prevent_project_tenant_reassignment()
  from public, anon, authenticated;

-- Table privileges: neither anon nor authenticated gets any direct
-- table-level access in this PR. RLS (a later, separate stage) is what
-- will eventually let `authenticated` read its own rows directly;
-- granting SELECT now, with no RLS yet, would let any authenticated user
-- read every tenant's rows directly via the Data API, bypassing the
-- interim application-layer scoping this PR relies on. The app itself
-- never needs anon/authenticated table privileges — it uses the
-- service-role client for reads/writes and this one SECURITY DEFINER RPC
-- (which runs with the function owner's privileges, not the caller's
-- table grants) for user-triggered project creation.
revoke all on public.organizations, public.organization_memberships
  from public, anon, authenticated;
revoke all on public.projects, public.workflow_runs, public.workflow_tasks, public.attempts, public.artifacts, public.workflow_checkpoints
  from public, anon, authenticated;
