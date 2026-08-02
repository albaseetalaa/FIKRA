import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url));
const FIX_MIGRATION_PATH = join(MIGRATIONS_DIR, "20260802123000_fix_create_project_membership_conflict.sql");
const ORIGINAL_MIGRATION_PATH = join(MIGRATIONS_DIR, "20260801100000_tenant_ownership_phase_a.sql");

const NAMED_CONSTRAINT = "organization_memberships_organization_id_user_id_key";

describe("create_project membership-conflict disambiguation migration", () => {
  const fixSource = readFileSync(FIX_MIGRATION_PATH, "utf8");

  it("uses the named unique constraint for the membership upsert", () => {
    expect(fixSource).toMatch(new RegExp(`on conflict\\s+on constraint\\s+${NAMED_CONSTRAINT}\\s+do nothing`, "i"));
  });

  it("does not reintroduce the ambiguous bare-column conflict target", () => {
    expect(fixSource.toLowerCase()).not.toContain("on conflict (organization_id, user_id)");
  });

  it("re-declares create_project with CREATE OR REPLACE FUNCTION, not a fresh CREATE FUNCTION", () => {
    expect(fixSource).toMatch(/create or replace function public\.create_project\(/i);
    expect(fixSource).not.toMatch(/(?<!or replace )\bcreate function public\.create_project\(/i);
  });

  it("preserves the exact original 13-parameter signature", () => {
    expect(fixSource).toMatch(
      /create or replace function public\.create_project\(\s*p_idea text,\s*p_business_name text default null,\s*p_industry text default null,\s*p_country text default null,\s*p_city text default null,\s*p_stage text default null,\s*p_audience text default null,\s*p_age_range text default null,\s*p_customer_type text default null,\s*p_goals text\[\] default null,\s*p_budget text default null,\s*p_timeline text default null,\s*p_currency text default null\s*\)/i,
    );
  });

  it("preserves the exact original RETURNS TABLE contract", () => {
    expect(fixSource).toMatch(/returns table \(project_id text, organization_id uuid, workflow_run_id text\)/i);
  });

  it("preserves SECURITY DEFINER and an empty search_path", () => {
    expect(fixSource).toMatch(/security definer/i);
    expect(fixSource).toMatch(/set search_path = ''/i);
  });

  it("preserves the execute revoke/grant policy for create_project", () => {
    expect(fixSource).toMatch(/revoke execute on function public\.create_project\(/i);
    expect(fixSource).toMatch(/from public, anon, authenticated;/i);
    expect(fixSource).toMatch(/grant execute on function public\.create_project\(/i);
    expect(fixSource).toMatch(/to authenticated;/i);
  });

  it("the already-applied Phase A migration was not modified", () => {
    // Instruction: do not edit or rewrite the already-applied migration.
    // The original ambiguous form must still be present there unchanged —
    // this fix is forward-only, applied via a new migration file.
    const originalSource = readFileSync(ORIGINAL_MIGRATION_PATH, "utf8");
    expect(originalSource).toContain("on conflict (organization_id, user_id) do nothing;");
  });
});
