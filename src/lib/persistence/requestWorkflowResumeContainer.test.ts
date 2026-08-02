import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestPersistenceContainer, getSystemPersistenceContainer, resetPersistenceContainerForTests } from "./setup";

const USER_A = "user-resume-container-a";
const USER_B = "user-resume-container-b";
const ORG_A = "org-resume-container-a";
const ORG_B = "org-resume-container-b";

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
  vi.restoreAllMocks();
});

function projectId() {
  return `proj_${Math.random().toString(36).slice(2, 10)}`;
}

function workflowRunId() {
  return `run_${Math.random().toString(36).slice(2, 10)}`;
}

async function seedProjectWithRun(params: { createdBy: string | null; organizationId: string | null }) {
  const system = getSystemPersistenceContainer();
  const project = await system.projects.create({
    id: projectId(),
    name: "Resume Container Test Project",
    idea: "Seed idea for request workflow resume container tests.",
    activePipelineId: "ceo_orchestrated",
    organizationId: params.organizationId,
    createdBy: params.createdBy,
  });
  const run = await system.workflowRuns.create({
    id: workflowRunId(),
    projectId: project.id,
    pipelineId: "ceo_orchestrated",
    status: "queued",
    progress: 0,
  });
  return { project, run };
}

describe("request persistence container — workflow resume", () => {
  describe("runtime capability surface", () => {
    it("1: exposes exactly projects and workflowResume at the container level", () => {
      const request = getRequestPersistenceContainer({ userId: USER_A });
      expect(Object.keys(request).sort()).toEqual(["projects", "workflowResume"]);
    });

    it("2: workflowResume exposes exactly findProjectForWorkflowRun", () => {
      const request = getRequestPersistenceContainer({ userId: USER_A });
      expect(Object.keys(request.workflowResume)).toEqual(["findProjectForWorkflowRun"]);
    });

    it("3: no system/admin/mutation capabilities are exposed anywhere on the container", () => {
      const request = getRequestPersistenceContainer({ userId: USER_A });
      const requestRecord = request as unknown as Record<string, unknown>;

      expect("provider" in requestRecord).toBe(false);
      expect("workflowRuns" in requestRecord).toBe(false);
      expect("workflowTasks" in requestRecord).toBe(false);
      expect("attempts" in requestRecord).toBe(false);
      expect("checkpoints" in requestRecord).toBe(false);
      expect("artifacts" in requestRecord).toBe(false);

      const projectsRecord = request.projects as unknown as Record<string, unknown>;
      expect("create" in projectsRecord).toBe(false);
      expect("update" in projectsRecord).toBe(false);
      expect("scopedToCreator" in projectsRecord).toBe(false);

      const workflowResumeRecord = request.workflowResume as unknown as Record<string, unknown>;
      expect("create" in workflowResumeRecord).toBe(false);
      expect("update" in workflowResumeRecord).toBe(false);
      expect("delete" in workflowResumeRecord).toBe(false);
      expect("scopedToCreator" in workflowResumeRecord).toBe(false);
    });
  });

  describe("tenant isolation", () => {
    it("4: user A resolves only user A's workflow runs", async () => {
      const { run } = await seedProjectWithRun({ createdBy: USER_A, organizationId: ORG_A });
      const request = getRequestPersistenceContainer({ userId: USER_A });

      const result = await request.workflowResume.findProjectForWorkflowRun(run.id);

      expect(result).toEqual({ workflowRunId: run.id, projectId: run.projectId, organizationId: ORG_A });
    });

    it("5: user B resolves only user B's workflow runs", async () => {
      const { run } = await seedProjectWithRun({ createdBy: USER_B, organizationId: ORG_B });
      const request = getRequestPersistenceContainer({ userId: USER_B });

      const result = await request.workflowResume.findProjectForWorkflowRun(run.id);

      expect(result).toEqual({ workflowRunId: run.id, projectId: run.projectId, organizationId: ORG_B });
    });

    it("6: legacy createdBy-null and organizationId-null records are hidden", async () => {
      const legacyNull = await seedProjectWithRun({ createdBy: null, organizationId: ORG_A });
      const nullOrg = await seedProjectWithRun({ createdBy: USER_A, organizationId: null });
      const request = getRequestPersistenceContainer({ userId: USER_A });

      expect(await request.workflowResume.findProjectForWorkflowRun(legacyNull.run.id)).toBeNull();
      expect(await request.workflowResume.findProjectForWorkflowRun(nullOrg.run.id)).toBeNull();
    });

    it("7: nonexistent and cross-creator workflow runs both return exactly null", async () => {
      const { run: crossCreatorRun } = await seedProjectWithRun({ createdBy: USER_B, organizationId: ORG_B });
      const request = getRequestPersistenceContainer({ userId: USER_A });

      const nonexistentResult = await request.workflowResume.findProjectForWorkflowRun("run_does_not_exist");
      const crossCreatorResult = await request.workflowResume.findProjectForWorkflowRun(crossCreatorRun.id);

      expect(nonexistentResult).toBeNull();
      expect(crossCreatorResult).toBeNull();
    });

    it("8: two request containers for different users remain independently bound", async () => {
      const { run: runA } = await seedProjectWithRun({ createdBy: USER_A, organizationId: ORG_A });
      const requestA = getRequestPersistenceContainer({ userId: USER_A });
      const requestB = getRequestPersistenceContainer({ userId: USER_B });

      await requestB.workflowResume.findProjectForWorkflowRun(runA.id);

      const stillOwned = await requestA.workflowResume.findProjectForWorkflowRun(runA.id);
      expect(stillOwned?.workflowRunId).toBe(runA.id);
    });
  });

  describe("userId validation (unchanged)", () => {
    it("9: rejects an empty userId", () => {
      expect(() => getRequestPersistenceContainer({ userId: "" })).toThrow(
        "getRequestPersistenceContainer requires a non-empty userId.",
      );
    });

    it("10: rejects a whitespace-only userId", () => {
      expect(() => getRequestPersistenceContainer({ userId: "   " })).toThrow(
        "getRequestPersistenceContainer requires a userId with no leading or trailing whitespace.",
      );
    });

    it("11: rejects a leading-whitespace userId without normalizing it", () => {
      expect(() => getRequestPersistenceContainer({ userId: " user-a" })).toThrow(
        "getRequestPersistenceContainer requires a userId with no leading or trailing whitespace.",
      );
    });

    it("12: rejects a trailing-whitespace userId without normalizing it", () => {
      expect(() => getRequestPersistenceContainer({ userId: "user-a " })).toThrow(
        "getRequestPersistenceContainer requires a userId with no leading or trailing whitespace.",
      );
    });
  });

  describe("existing projects façade (unchanged)", () => {
    it("13: projects exposes exactly getById and list", () => {
      const request = getRequestPersistenceContainer({ userId: USER_A });
      expect(Object.keys(request.projects).sort()).toEqual(["getById", "list"]);
    });
  });
});
