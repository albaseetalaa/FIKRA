import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseWorkflowResumeRepository } from "./repositories";

type FakeResponse = { data: unknown; error: unknown };
type RecordedCall = { method: string; args: unknown[] };

class FakeQueryBuilder {
  readonly calls: RecordedCall[] = [];

  constructor(private readonly response: FakeResponse) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ method, args });
    return this;
  }

  from(...args: unknown[]): this {
    return this.record("from", args);
  }

  select(...args: unknown[]): this {
    return this.record("select", args);
  }

  eq(...args: unknown[]): this {
    return this.record("eq", args);
  }

  not(...args: unknown[]): this {
    return this.record("not", args);
  }

  maybeSingle(...args: unknown[]): Promise<FakeResponse> {
    this.record("maybeSingle", args);
    return Promise.resolve(this.response);
  }
}

function createFakeSupabaseClient(response: FakeResponse) {
  const builder = new FakeQueryBuilder(response);
  return { db: builder as unknown as SupabaseClient, calls: builder.calls };
}

describe("createSupabaseWorkflowResumeRepository", () => {
  it("1: the query enforces id, created_by, and organization_id-not-null conditions", async () => {
    const { db, calls } = createFakeSupabaseClient({
      data: { id: "run_1", project_id: "proj_1", projects: { organization_id: "org_1", created_by: "user-resume-a" } },
      error: null,
    });
    const repo = createSupabaseWorkflowResumeRepository(db, "user-resume-a");

    await repo.findProjectForWorkflowRun("run_1");

    expect(calls.some((c) => c.method === "eq" && c.args[0] === "id" && c.args[1] === "run_1")).toBe(true);
    expect(
      calls.some((c) => c.method === "eq" && c.args[0] === "projects.created_by" && c.args[1] === "user-resume-a"),
    ).toBe(true);
    expect(
      calls.some(
        (c) => c.method === "not" && c.args[0] === "projects.organization_id" && c.args[1] === "is" && c.args[2] === null,
      ),
    ).toBe(true);
  });

  it("2: maps an authorized joined row to { workflowRunId, projectId, organizationId }", async () => {
    const { db } = createFakeSupabaseClient({
      data: { id: "run_1", project_id: "proj_1", projects: { organization_id: "org_1", created_by: "user-resume-a" } },
      error: null,
    });
    const repo = createSupabaseWorkflowResumeRepository(db, "user-resume-a");

    const result = await repo.findProjectForWorkflowRun("run_1");

    expect(result).toEqual({ workflowRunId: "run_1", projectId: "proj_1", organizationId: "org_1" });
  });

  it("3: a cross-creator result (no matching row) returns null", async () => {
    const { db } = createFakeSupabaseClient({ data: null, error: null });
    const repo = createSupabaseWorkflowResumeRepository(db, "user-resume-a");

    expect(await repo.findProjectForWorkflowRun("run_1")).toBeNull();
  });

  it("4: created_by null in the joined row returns null", async () => {
    const { db } = createFakeSupabaseClient({
      data: { id: "run_1", project_id: "proj_1", projects: { organization_id: "org_1", created_by: null } },
      error: null,
    });
    const repo = createSupabaseWorkflowResumeRepository(db, "user-resume-a");

    expect(await repo.findProjectForWorkflowRun("run_1")).toBeNull();
  });

  it("5: organization_id null in the joined row returns null", async () => {
    const { db } = createFakeSupabaseClient({
      data: { id: "run_1", project_id: "proj_1", projects: { organization_id: null, created_by: "user-resume-a" } },
      error: null,
    });
    const repo = createSupabaseWorkflowResumeRepository(db, "user-resume-a");

    expect(await repo.findProjectForWorkflowRun("run_1")).toBeNull();
  });

  it("6: a missing run/project join returns null", async () => {
    const { db } = createFakeSupabaseClient({ data: null, error: null });
    const repo = createSupabaseWorkflowResumeRepository(db, "user-resume-a");

    expect(await repo.findProjectForWorkflowRun("run_missing")).toBeNull();
  });

  it("7: malformed or ambiguous joined data throws rather than being silently accepted", async () => {
    const { db } = createFakeSupabaseClient({
      data: {
        id: "run_1",
        project_id: "proj_1",
        projects: [
          { organization_id: "org_1", created_by: "user-resume-a" },
          { organization_id: "org_2", created_by: "user-resume-a" },
        ],
      },
      error: null,
    });
    const repo = createSupabaseWorkflowResumeRepository(db, "user-resume-a");

    await expect(repo.findProjectForWorkflowRun("run_1")).rejects.toThrow();
  });

  it("8: no insert/update/delete/upsert/rpc method is available or invoked", async () => {
    const { db } = createFakeSupabaseClient({
      data: { id: "run_1", project_id: "proj_1", projects: { organization_id: "org_1", created_by: "user-resume-a" } },
      error: null,
    });
    const repo = createSupabaseWorkflowResumeRepository(db, "user-resume-a");

    await repo.findProjectForWorkflowRun("run_1");

    const dbRecord = db as unknown as Record<string, unknown>;
    expect(dbRecord.insert).toBeUndefined();
    expect(dbRecord.update).toBeUndefined();
    expect(dbRecord.delete).toBeUndefined();
    expect(dbRecord.upsert).toBeUndefined();
    expect(dbRecord.rpc).toBeUndefined();
  });
});
