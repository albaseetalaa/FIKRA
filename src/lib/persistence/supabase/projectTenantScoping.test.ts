import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseProjectRepository } from "./repositories";
import type { ProjectRepository } from "../interfaces";

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

  insert(...args: unknown[]): this {
    return this.record("insert", args);
  }

  update(...args: unknown[]): this {
    return this.record("update", args);
  }

  eq(...args: unknown[]): this {
    return this.record("eq", args);
  }

  order(...args: unknown[]): this {
    return this.record("order", args);
  }

  limit(...args: unknown[]): this {
    return this.record("limit", args);
  }

  maybeSingle(...args: unknown[]): Promise<FakeResponse> {
    this.record("maybeSingle", args);
    return Promise.resolve(this.response);
  }

  single(...args: unknown[]): Promise<FakeResponse> {
    this.record("single", args);
    return Promise.resolve(this.response);
  }

  then<TResult1 = FakeResponse, TResult2 = never>(
    onFulfilled?: ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.response).then(onFulfilled, onRejected);
  }
}

function createFakeSupabaseClient(response: FakeResponse) {
  const builder = new FakeQueryBuilder(response);
  return { db: builder as unknown as SupabaseClient, calls: builder.calls };
}

const fixedIso = "2026-08-01T12:00:00.000Z";

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "proj_abc123",
    name: "Test Project",
    idea: "Test idea for tenant scoping.",
    metadata_json: {},
    status: "queued",
    active_pipeline_id: "business_strategist_only",
    organization_id: "org-1",
    created_by: "user-a",
    created_at: fixedIso,
    updated_at: fixedIso,
    completed_at: null,
    error_code: null,
    sanitized_error_message: null,
    ...overrides,
  };
}

describe("Supabase creator-scoped repository (returned by scopedToCreator)", () => {
  it("1: has no runtime scopedToCreator method and cannot be rebound", () => {
    const { db } = createFakeSupabaseClient({ data: null, error: null });
    const system = new SupabaseProjectRepository(db);
    const scoped: ProjectRepository = system.scopedToCreator("user-a");

    const runtimeScoped = scoped as unknown as { scopedToCreator?: unknown };
    expect(typeof runtimeScoped.scopedToCreator).toBe("undefined");
    expect("scopedToCreator" in Object(scoped)).toBe(false);
  });

  it("2: create() throws immediately and makes no database-client calls", async () => {
    const { db, calls } = createFakeSupabaseClient({ data: null, error: null });
    const scoped = new SupabaseProjectRepository(db).scopedToCreator("user-a");

    await expect(
      scoped.create({
        id: "proj_new",
        name: "New",
        idea: "New idea for tenant scoping.",
        activePipelineId: "business_strategist_only",
      }),
    ).rejects.toThrow();

    expect(calls.length).toBe(0);
  });

  it("3: list() applies created_by before order and limit", async () => {
    const rows = [makeRow({ id: "proj_1" }), makeRow({ id: "proj_2" })];
    const { db, calls } = createFakeSupabaseClient({ data: rows, error: null });
    const scoped = new SupabaseProjectRepository(db).scopedToCreator("user-a");

    const result = await scoped.list(10);
    expect(result.map((p) => p.id)).toEqual(["proj_1", "proj_2"]);

    const createdByIndex = calls.findIndex(
      (c) => c.method === "eq" && c.args[0] === "created_by" && c.args[1] === "user-a",
    );
    const orderIndex = calls.findIndex((c) => c.method === "order");
    const limitIndex = calls.findIndex((c) => c.method === "limit");

    expect(createdByIndex).toBeGreaterThanOrEqual(0);
    expect(orderIndex).toBeGreaterThan(createdByIndex);
    expect(limitIndex).toBeGreaterThan(createdByIndex);
  });

  it("4: getById() applies both id and created_by filters before maybeSingle", async () => {
    const row = makeRow({ id: "proj_1", created_by: "user-a" });
    const { db, calls } = createFakeSupabaseClient({ data: row, error: null });
    const scoped = new SupabaseProjectRepository(db).scopedToCreator("user-a");

    const result = await scoped.getById("proj_1");
    expect(result?.id).toBe("proj_1");

    const idFilterIndex = calls.findIndex((c) => c.method === "eq" && c.args[0] === "id" && c.args[1] === "proj_1");
    const createdByFilterIndex = calls.findIndex(
      (c) => c.method === "eq" && c.args[0] === "created_by" && c.args[1] === "user-a",
    );
    const maybeSingleIndex = calls.findIndex((c) => c.method === "maybeSingle");

    expect(idFilterIndex).toBeGreaterThanOrEqual(0);
    expect(createdByFilterIndex).toBeGreaterThanOrEqual(0);
    expect(maybeSingleIndex).toBeGreaterThan(idFilterIndex);
    expect(maybeSingleIndex).toBeGreaterThan(createdByFilterIndex);
  });

  it("5: getById() returns null when maybeSingle resolves no row", async () => {
    const { db } = createFakeSupabaseClient({ data: null, error: null });
    const scoped = new SupabaseProjectRepository(db).scopedToCreator("user-a");

    expect(await scoped.getById("proj_missing")).toBeNull();
  });

  it("6: update() applies both id and created_by filters before the terminal result operation", async () => {
    const row = makeRow({ id: "proj_1", created_by: "user-a", name: "Renamed" });
    const { db, calls } = createFakeSupabaseClient({ data: row, error: null });
    const scoped = new SupabaseProjectRepository(db).scopedToCreator("user-a");

    const result = await scoped.update("proj_1", { name: "Renamed" });
    expect(result?.name).toBe("Renamed");

    const idFilterIndex = calls.findIndex((c) => c.method === "eq" && c.args[0] === "id" && c.args[1] === "proj_1");
    const createdByFilterIndex = calls.findIndex(
      (c) => c.method === "eq" && c.args[0] === "created_by" && c.args[1] === "user-a",
    );
    const terminalIndex = calls.findIndex((c) => c.method === "maybeSingle" || c.method === "single");

    expect(idFilterIndex).toBeGreaterThanOrEqual(0);
    expect(createdByFilterIndex).toBeGreaterThanOrEqual(0);
    expect(terminalIndex).toBeGreaterThan(idFilterIndex);
    expect(terminalIndex).toBeGreaterThan(createdByFilterIndex);
  });

  it("7: update() returns null when no row matches", async () => {
    const { db } = createFakeSupabaseClient({ data: null, error: null });
    const scoped = new SupabaseProjectRepository(db).scopedToCreator("user-a");

    expect(await scoped.update("proj_missing", { name: "x" })).toBeNull();
  });

  it("8: update() throws before any database-client call when the patch touches organizationId or createdBy", async () => {
    const { db, calls } = createFakeSupabaseClient({ data: null, error: null });
    const scoped = new SupabaseProjectRepository(db).scopedToCreator("user-a");

    await expect(scoped.update("proj_1", { organizationId: "org-2" })).rejects.toThrow();
    expect(calls.length).toBe(0);

    await expect(scoped.update("proj_1", { createdBy: null })).rejects.toThrow();
    expect(calls.length).toBe(0);
  });
});
