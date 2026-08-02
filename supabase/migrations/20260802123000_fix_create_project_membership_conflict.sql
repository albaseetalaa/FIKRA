-- Fix: public.create_project() raised PostgreSQL error 42702 ("column
-- reference \"organization_id\" is ambiguous") at runtime.
--
-- Root cause: create_project() is declared with
--   returns table (project_id text, organization_id uuid, workflow_run_id text)
-- Inside a PL/pgSQL function, every RETURNS TABLE column implicitly becomes
-- an OUT parameter accessible by that exact bare name within the function
-- body. The function's own INSERT into public.organization_memberships
-- targeted its ON CONFLICT clause directly at the raw (organization_id,
-- user_id) column pair of that table's unique constraint.
-- The ON CONFLICT target-column list is evaluated in an expression context,
-- so the parser could not tell whether "organization_id" meant the
-- organization_memberships.organization_id table column or the function's
-- own organization_id OUT parameter, and PostgreSQL raised 42702.
--
-- Verified no other output-variable/column ambiguity exists in this
-- function for project_id, organization_id, or workflow_run_id:
--   - The other ON CONFLICT target, `on conflict (personal_owner_user_id)
--     where personal_owner_user_id is not null`, does not reference any of
--     the three RETURNS TABLE column names — not ambiguous.
--   - Every other bare occurrence of project_id/organization_id/
--     workflow_run_id in this function appears only inside an INSERT
--     target column list (e.g. `insert into public.projects (id, name,
--     idea, status, active_pipeline_id, metadata_json, organization_id,
--     created_by)` and `insert into public.workflow_runs (id, project_id,
--     ...)`). An INSERT target column list is pure column-identifier
--     syntax, never evaluated as an expression, so PostgreSQL resolves it
--     directly against the target table's columns without ever consulting
--     PL/pgSQL's variable/OUT-parameter namespace — those are not
--     ambiguous and are left unchanged.
--   - `return query select v_project_id, v_org_id, v_workflow_run_id;`
--     selects the function's own v_-prefixed local variables (not the
--     bare RETURNS TABLE names) and binds them to the output columns by
--     position, not by name — not ambiguous.
--
-- Constraint name verification (per instruction: do not guess silently):
-- organization_memberships was created in
-- 20260801100000_tenant_ownership_phase_a.sql with an inline, unnamed
-- table constraint:
--   unique (organization_id, user_id)
-- PostgreSQL deterministically names an unnamed multi-column UNIQUE table
-- constraint "<table>_<col1>_<col2>_key". For table
-- "organization_memberships" and columns "organization_id", "user_id",
-- that name is:
--   organization_memberships_organization_id_user_id_key
-- (54 characters — under the 63-byte NAMEDATALEN identifier limit, so
-- PostgreSQL does not truncate/hash it). No other migration renames or
-- redefines this constraint, so this is the actual, currently-applied
-- constraint name, not a guess.
--
-- Fix: reference the named constraint directly (`on conflict on
-- constraint ...`), which is never ambiguous with a PL/pgSQL variable,
-- instead of the bare ON CONFLICT column-list target.
--
-- This migration only changes that one ON CONFLICT target. It does not
-- edit or rewrite 20260801100000_tenant_ownership_phase_a.sql — the
-- already-applied migration is forward-fixed here via
-- CREATE OR REPLACE FUNCTION, with every other parameter, default,
-- return contract, validation rule, and side effect kept byte-for-byte
-- identical to the original.

create or replace function public.create_project(
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

  -- Fixed: reference the named unique constraint instead of the bare
  -- (organization_id, user_id) column-list target, which was ambiguous
  -- against this function's own organization_id RETURNS TABLE/OUT
  -- parameter (PostgreSQL error 42702).
  insert into public.organization_memberships (organization_id, user_id, role)
  values (v_org_id, v_uid, 'owner')
  on conflict on constraint organization_memberships_organization_id_user_id_key
  do nothing;

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

-- CREATE OR REPLACE FUNCTION preserves the existing owner and previously
-- granted privileges, but the grant/revoke pair is restated explicitly
-- here so this migration is self-contained and idempotent-by-inspection,
-- matching the privilege policy established in the original migration.
revoke execute on function public.create_project(
  text, text, text, text, text, text, text, text, text, text[], text, text, text
) from public, anon, authenticated;
grant execute on function public.create_project(
  text, text, text, text, text, text, text, text, text, text[], text, text, text
) to authenticated;
