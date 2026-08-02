import { describe, expect, it } from "vitest";
import { InMemoryProjectRepository } from "./repositories";
import type { ProjectRepository } from "../interfaces";

function projectId() {
  return `proj_${Math.random().toString(36).slice(2, 10)}`;
}

function makeCreateInput(overrides: {
  id?: string;
  name?: string;
  idea?: string;
  activePipelineId?: string;
  organizationId?: string | null;
  createdBy?: string | null;
}) {
  return {
    id: overrides.id ?? projectId(),
    name: overrides.name ?? "Test Project",
    idea: overrides.idea ?? "Test idea for tenant scoping behavior.",
    activePipelineId: overrides.activePipelineId ?? "business_strategist_only",
    organizationId: overrides.organizationId ?? null,
    createdBy: overrides.createdBy ?? null,
  };
}

describe("unscoped InMemoryProjectRepository (system/background)", () => {
  it("A1: create() persists organizationId and createdBy", async () => {
    const repo = new InMemoryProjectRepository();
    const record = await repo.create(makeCreateInput({ organizationId: "org-1", createdBy: "user-a" }));

    expect(record.organizationId).toBe("org-1");
    expect(record.createdBy).toBe("user-a");

    const reloaded = await repo.getById(record.id);
    expect(reloaded?.organizationId).toBe("org-1");
    expect(reloaded?.createdBy).toBe("user-a");
  });

  it("A2: organizationId is write-once — null to a value succeeds once, any further change throws", async () => {
    const repo = new InMemoryProjectRepository();
    const record = await repo.create(makeCreateInput({ organizationId: null, createdBy: "user-a" }));

    const withOrg = await repo.update(record.id, { organizationId: "org-1" });
    expect(withOrg?.organizationId).toBe("org-1");

    await expect(repo.update(record.id, { organizationId: "org-2" })).rejects.toThrow();
    await expect(repo.update(record.id, { organizationId: null })).rejects.toThrow();
  });

  it("A3: createdBy may be nulled but never reassigned to a different non-null value", async () => {
    const repo = new InMemoryProjectRepository();
    const record = await repo.create(makeCreateInput({ organizationId: "org-1", createdBy: null }));

    const withCreator = await repo.update(record.id, { createdBy: "user-a" });
    expect(withCreator?.createdBy).toBe("user-a");

    const nulled = await repo.update(record.id, { createdBy: null });
    expect(nulled?.createdBy).toBeNull();

    const withCreatorAgain = await repo.update(record.id, { createdBy: "user-b" });
    expect(withCreatorAgain?.createdBy).toBe("user-b");

    await expect(repo.update(record.id, { createdBy: "user-c" })).rejects.toThrow();
  });

  it("A4: unscoped list/getById/update retain full cross-creator visibility and mutation", async () => {
    const repo = new InMemoryProjectRepository();
    const a = await repo.create(makeCreateInput({ createdBy: "user-a" }));
    const b = await repo.create(makeCreateInput({ createdBy: "user-b" }));

    const all = await repo.list();
    expect(all.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());

    expect((await repo.getById(a.id))?.id).toBe(a.id);
    expect((await repo.getById(b.id))?.id).toBe(b.id);

    const updatedB = await repo.update(b.id, { name: "Renamed by system" });
    expect(updatedB?.name).toBe("Renamed by system");
  });
});

describe("creator-scoped repository (returned by scopedToCreator)", () => {
  it("B1: cannot be rebound — has no runtime scopedToCreator method", async () => {
    const system = new InMemoryProjectRepository();
    const scoped: ProjectRepository = system.scopedToCreator("user-a");

    expect(typeof (scoped as unknown as { scopedToCreator?: unknown }).scopedToCreator).toBe("undefined");
  });

  it("B2: scoped list() returns only the bound creator's records", async () => {
    const system = new InMemoryProjectRepository();
    await system.create(makeCreateInput({ createdBy: "user-a" }));
    await system.create(makeCreateInput({ createdBy: "user-b" }));
    const ownProject = await system.create(makeCreateInput({ createdBy: "user-a" }));

    const scopedA = system.scopedToCreator("user-a");
    const list = await scopedA.list();

    expect(list.length).toBe(2);
    expect(list.every((p) => p.createdBy === "user-a")).toBe(true);
    expect(list.some((p) => p.id === ownProject.id)).toBe(true);
  });

  it("B3: scoped getById() returns null for another creator's project and for a legacy null-createdBy project", async () => {
    const system = new InMemoryProjectRepository();
    const other = await system.create(makeCreateInput({ createdBy: "user-b" }));
    const legacy = await system.create(makeCreateInput({ createdBy: null }));

    const scopedA = system.scopedToCreator("user-a");

    expect(await scopedA.getById(other.id)).toBeNull();
    expect(await scopedA.getById(legacy.id)).toBeNull();
  });

  it("B4: scoped update() returns null and makes no mutation for another creator's project", async () => {
    const system = new InMemoryProjectRepository();
    const other = await system.create(makeCreateInput({ createdBy: "user-b", name: "Original" }));

    const scopedA = system.scopedToCreator("user-a");
    const result = await scopedA.update(other.id, { name: "Hijacked" });

    expect(result).toBeNull();
    const reloaded = await system.getById(other.id);
    expect(reloaded?.name).toBe("Original");
  });

  it("B5: scoped update() throws when the patch touches organizationId or createdBy on the caller's own project", async () => {
    const system = new InMemoryProjectRepository();
    const own = await system.create(makeCreateInput({ createdBy: "user-a", organizationId: "org-1" }));

    const scopedA = system.scopedToCreator("user-a");

    await expect(scopedA.update(own.id, { organizationId: "org-2" })).rejects.toThrow();
    await expect(scopedA.update(own.id, { createdBy: null })).rejects.toThrow();
    await expect(scopedA.update(own.id, { createdBy: "user-a" })).rejects.toThrow();
  });

  it("B6: scoped create() always throws and leaves the shared backing store unchanged", async () => {
    const system = new InMemoryProjectRepository();
    const before = await system.list();

    const scopedA = system.scopedToCreator("user-a");
    await expect(scopedA.create(makeCreateInput({ createdBy: "user-a" }))).rejects.toThrow();

    const after = await system.list();
    expect(after.length).toBe(before.length);
  });
});
