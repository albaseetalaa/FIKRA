import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSystemPersistenceContainer, resetPersistenceContainerForTests } from "../persistence/setup";
import { authorizeProjectStart } from "./service";

const USER_A = "user-start-a";
const USER_B = "user-start-b";
const ORG_A = "org-start-a";
const ORG_B = "org-start-b";

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

async function seedProject(params: { createdBy: string | null; organizationId: string | null; id?: string }) {
  const system = getSystemPersistenceContainer();
  return system.projects.create({
    id: params.id ?? projectId(),
    name: "Start Test Project",
    idea: "Seed idea for start authorization tests.",
    activePipelineId: "ceo_orchestrated",
    organizationId: params.organizationId,
    createdBy: params.createdBy,
  });
}

describe("authorizeProjectStart", () => {
  it("1: owner authorization returns exactly { projectId, organizationId }", async () => {
    const project = await seedProject({ createdBy: USER_A, organizationId: ORG_A });

    const handoff = await authorizeProjectStart({ userId: USER_A }, project.id);

    expect(handoff).toEqual({ projectId: project.id, organizationId: ORG_A });
  });

  it("2: the handoff contains exactly projectId and organizationId, nothing else", async () => {
    const project = await seedProject({ createdBy: USER_A, organizationId: ORG_A });

    const handoff = await authorizeProjectStart({ userId: USER_A }, project.id);

    expect(handoff && Object.keys(handoff).sort()).toEqual(["organizationId", "projectId"]);
    expect(handoff && "userId" in handoff).toBe(false);
    expect(handoff && "createdBy" in handoff).toBe(false);
    expect(handoff && "idea" in handoff).toBe(false);
    expect(handoff && "metadata" in handoff).toBe(false);
    expect(handoff && "workflowRunId" in handoff).toBe(false);
  });

  it("3: user A receives null for user B's project", async () => {
    const project = await seedProject({ createdBy: USER_B, organizationId: ORG_B });

    const handoff = await authorizeProjectStart({ userId: USER_A }, project.id);

    expect(handoff).toBeNull();
  });

  it("4: user B receives null for user A's project", async () => {
    const project = await seedProject({ createdBy: USER_A, organizationId: ORG_A });

    const handoff = await authorizeProjectStart({ userId: USER_B }, project.id);

    expect(handoff).toBeNull();
  });

  it("5: a project with createdBy null returns null", async () => {
    const project = await seedProject({ createdBy: null, organizationId: ORG_A });

    const handoff = await authorizeProjectStart({ userId: USER_A }, project.id);

    expect(handoff).toBeNull();
  });

  it("6: a project with organizationId null returns null even when createdBy matches", async () => {
    const project = await seedProject({ createdBy: USER_A, organizationId: null });

    const handoff = await authorizeProjectStart({ userId: USER_A }, project.id);

    expect(handoff).toBeNull();
  });

  it("7: a nonexistent project returns null", async () => {
    const handoff = await authorizeProjectStart({ userId: USER_A }, "proj_does_not_exist_start");

    expect(handoff).toBeNull();
  });

  it("8: cross-creator, legacy-null, null-organization, and nonexistent cases are indistinguishable", async () => {
    const crossCreator = await seedProject({ createdBy: USER_B, organizationId: ORG_B });
    const legacyNull = await seedProject({ createdBy: null, organizationId: ORG_A });
    const nullOrg = await seedProject({ createdBy: USER_A, organizationId: null });

    const results = await Promise.all([
      authorizeProjectStart({ userId: USER_A }, crossCreator.id),
      authorizeProjectStart({ userId: USER_A }, legacyNull.id),
      authorizeProjectStart({ userId: USER_A }, nullOrg.id),
      authorizeProjectStart({ userId: USER_A }, "proj_does_not_exist_start_2"),
    ]);

    for (const result of results) {
      expect(result).toBeNull();
    }
  });

  it("9: authorization uses the request-scoped repository, never the unscoped system repository", async () => {
    const project = await seedProject({ createdBy: USER_A, organizationId: ORG_A });
    const system = getSystemPersistenceContainer();
    const getByIdSpy = vi.spyOn(system.projects, "getById");
    const listSpy = vi.spyOn(system.projects, "list");

    await authorizeProjectStart({ userId: USER_A }, project.id);

    expect(getByIdSpy).not.toHaveBeenCalled();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it("10: no workflow, task, attempt, checkpoint, or artifact repository is accessed during authorization", async () => {
    const project = await seedProject({ createdBy: USER_A, organizationId: ORG_A });
    const system = getSystemPersistenceContainer();
    const workflowRunsGetLatestSpy = vi.spyOn(system.workflowRuns, "getLatestByProject");
    const workflowRunsCreateSpy = vi.spyOn(system.workflowRuns, "create");
    const workflowTasksSpy = vi.spyOn(system.workflowTasks, "upsert");
    const attemptsSpy = vi.spyOn(system.attempts, "create");
    const checkpointsSpy = vi.spyOn(system.checkpoints, "getActiveByWorkflowRunId");
    const artifactsSpy = vi.spyOn(system.artifacts, "list");

    await authorizeProjectStart({ userId: USER_A }, project.id);

    expect(workflowRunsGetLatestSpy).not.toHaveBeenCalled();
    expect(workflowRunsCreateSpy).not.toHaveBeenCalled();
    expect(workflowTasksSpy).not.toHaveBeenCalled();
    expect(attemptsSpy).not.toHaveBeenCalled();
    expect(checkpointsSpy).not.toHaveBeenCalled();
    expect(artifactsSpy).not.toHaveBeenCalled();
  });
});
