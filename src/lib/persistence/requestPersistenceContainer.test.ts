import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPersistenceContainer,
  getRequestPersistenceContainer,
  getSystemPersistenceContainer,
  resetPersistenceContainerForTests,
} from "./setup";
import type { RequestPersistenceContainer } from "./interfaces";

function forceMemoryProvider() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AI_PERSISTENCE_PROVIDER", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
}

beforeEach(() => {
  forceMemoryProvider();
  resetPersistenceContainerForTests();
});

afterEach(() => {
  resetPersistenceContainerForTests();
  vi.unstubAllEnvs();
});

function projectId() {
  return `proj_${Math.random().toString(36).slice(2, 10)}`;
}

async function seedProject(overrides: { id?: string; createdBy?: string | null; name?: string } = {}) {
  const system = getSystemPersistenceContainer();
  return system.projects.create({
    id: overrides.id ?? projectId(),
    name: overrides.name ?? "Seed Project",
    idea: "Seed idea for request container tests.",
    activePipelineId: "business_strategist_only",
    organizationId: null,
    createdBy: overrides.createdBy ?? null,
  });
}

describe("request persistence container", () => {
  describe("runtime capability surface", () => {
    it("1: exposes exactly projects and workflowResume at the container level", () => {
      const requestContainer: RequestPersistenceContainer = getRequestPersistenceContainer({ userId: "user-a" });
      expect(Object.keys(requestContainer).sort()).toEqual(["projects", "workflowResume"]);
    });

    it("2: exposes exactly getById and list on projects", () => {
      const requestContainer = getRequestPersistenceContainer({ userId: "user-a" });
      expect(Object.keys(requestContainer.projects).sort()).toEqual(["getById", "list"]);
    });

    it("3: create, update, and scopedToCreator are absent from projects", () => {
      const requestContainer = getRequestPersistenceContainer({ userId: "user-a" });
      expect("create" in requestContainer.projects).toBe(false);
      expect("update" in requestContainer.projects).toBe(false);
      expect("scopedToCreator" in requestContainer.projects).toBe(false);
    });

    it("4: provider and every non-project repository are absent from the container", () => {
      const requestContainer = getRequestPersistenceContainer({ userId: "user-a" });
      expect("provider" in requestContainer).toBe(false);
      expect("workflowRuns" in requestContainer).toBe(false);
      expect("workflowTasks" in requestContainer).toBe(false);
      expect("attempts" in requestContainer).toBe(false);
      expect("checkpoints" in requestContainer).toBe(false);
      expect("artifacts" in requestContainer).toBe(false);
    });
  });

  describe("tenant isolation", () => {
    it("5: user-a lists only user-a projects", async () => {
      const a1 = await seedProject({ createdBy: "user-a" });
      await seedProject({ createdBy: "user-b" });
      const a2 = await seedProject({ createdBy: "user-a" });

      const containerA = getRequestPersistenceContainer({ userId: "user-a" });
      const list = await containerA.projects.list();

      expect(list.map((p) => p.id).sort()).toEqual([a1.id, a2.id].sort());
    });

    it("6: user-b lists only user-b projects", async () => {
      await seedProject({ createdBy: "user-a" });
      const b1 = await seedProject({ createdBy: "user-b" });

      const containerB = getRequestPersistenceContainer({ userId: "user-b" });
      const list = await containerB.projects.list();

      expect(list.map((p) => p.id)).toEqual([b1.id]);
    });

    it("7: user-a getById returns null for user-b's project", async () => {
      const bProject = await seedProject({ createdBy: "user-b" });
      const containerA = getRequestPersistenceContainer({ userId: "user-a" });

      expect(await containerA.projects.getById(bProject.id)).toBeNull();
    });

    it("8: user-b getById returns null for user-a's project", async () => {
      const aProject = await seedProject({ createdBy: "user-a" });
      const containerB = getRequestPersistenceContainer({ userId: "user-b" });

      expect(await containerB.projects.getById(aProject.id)).toBeNull();
    });

    it("9: legacy projects with createdBy null are hidden", async () => {
      const legacy = await seedProject({ createdBy: null });
      const containerA = getRequestPersistenceContainer({ userId: "user-a" });

      expect(await containerA.projects.getById(legacy.id)).toBeNull();
      const list = await containerA.projects.list();
      expect(list.some((p) => p.id === legacy.id)).toBe(false);
    });

    it("10: constructing and using user-b's container does not alter user-a's bound identity", async () => {
      const aProject = await seedProject({ createdBy: "user-a" });
      const containerA = getRequestPersistenceContainer({ userId: "user-a" });

      const containerB = getRequestPersistenceContainer({ userId: "user-b" });
      await containerB.projects.list();
      await containerB.projects.getById(aProject.id);

      const stillOwned = await containerA.projects.getById(aProject.id);
      expect(stillOwned?.id).toBe(aProject.id);
    });
  });

  describe("userId validation", () => {
    it("11: rejects an empty userId", () => {
      expect(() => getRequestPersistenceContainer({ userId: "" })).toThrow(
        "getRequestPersistenceContainer requires a non-empty userId.",
      );
    });

    it("12: rejects a whitespace-only userId", () => {
      expect(() => getRequestPersistenceContainer({ userId: "   " })).toThrow(
        "getRequestPersistenceContainer requires a userId with no leading or trailing whitespace.",
      );
    });

    it("13: rejects a leading-whitespace userId without normalizing it", () => {
      expect(() => getRequestPersistenceContainer({ userId: " user-a" })).toThrow(
        "getRequestPersistenceContainer requires a userId with no leading or trailing whitespace.",
      );
    });

    it("14: rejects a trailing-whitespace userId without normalizing it", () => {
      expect(() => getRequestPersistenceContainer({ userId: "user-a " })).toThrow(
        "getRequestPersistenceContainer requires a userId with no leading or trailing whitespace.",
      );
    });
  });

  describe("system container regression", () => {
    it("15: getSystemPersistenceContainer is a singleton, and the compatibility alias returns the same instance", () => {
      const system = getSystemPersistenceContainer();
      expect(getSystemPersistenceContainer()).toBe(system);
      expect(getPersistenceContainer()).toBe(system);
    });

    it("16: system projects repository remains fully unscoped across creators", async () => {
      const system = getSystemPersistenceContainer();
      const a = await system.projects.create({
        id: projectId(),
        name: "System A",
        idea: "System-scoped idea for regression coverage.",
        activePipelineId: "business_strategist_only",
        organizationId: null,
        createdBy: "user-a",
      });
      const b = await system.projects.create({
        id: projectId(),
        name: "System B",
        idea: "System-scoped idea for regression coverage.",
        activePipelineId: "business_strategist_only",
        organizationId: null,
        createdBy: "user-b",
      });

      const all = await system.projects.list();
      expect(all.map((p) => p.id)).toEqual(expect.arrayContaining([a.id, b.id]));

      expect((await system.projects.getById(b.id))?.id).toBe(b.id);

      const updated = await system.projects.update(a.id, { name: "Renamed by system" });
      expect(updated?.name).toBe("Renamed by system");
    });
  });
});
