import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSystemPersistenceContainer, resetPersistenceContainerForTests } from "../setup";
import { createInMemoryWorkflowResumeRepository } from "./repositories";

const USER_A = "user-resume-a";
const USER_B = "user-resume-b";
const ORG_A = "org-resume-a";
const ORG_B = "org-resume-b";

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
    name: "Resume Test Project",
    idea: "Seed idea for workflow resume tenant scoping tests.",
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

describe("createInMemoryWorkflowResumeRepository", () => {
  it("1: user A can resolve a workflow run belonging to user A's project", async () => {
    const { run } = await seedProjectWithRun({ createdBy: USER_A, organizationId: ORG_A });
    const system = getSystemPersistenceContainer();
    const repo = createInMemoryWorkflowResumeRepository(system, USER_A);

    const result = await repo.findProjectForWorkflowRun(run.id);

    expect(result).toEqual({ workflowRunId: run.id, projectId: run.projectId, organizationId: ORG_A });
  });

  it("2: user B can resolve user B's workflow run", async () => {
    const { run } = await seedProjectWithRun({ createdBy: USER_B, organizationId: ORG_B });
    const system = getSystemPersistenceContainer();
    const repo = createInMemoryWorkflowResumeRepository(system, USER_B);

    const result = await repo.findProjectForWorkflowRun(run.id);

    expect(result).toEqual({ workflowRunId: run.id, projectId: run.projectId, organizationId: ORG_B });
  });

  it("3: user A receives null for user B's workflow run", async () => {
    const { run } = await seedProjectWithRun({ createdBy: USER_B, organizationId: ORG_B });
    const system = getSystemPersistenceContainer();
    const repo = createInMemoryWorkflowResumeRepository(system, USER_A);

    expect(await repo.findProjectForWorkflowRun(run.id)).toBeNull();
  });

  it("4: user B receives null for user A's workflow run", async () => {
    const { run } = await seedProjectWithRun({ createdBy: USER_A, organizationId: ORG_A });
    const system = getSystemPersistenceContainer();
    const repo = createInMemoryWorkflowResumeRepository(system, USER_B);

    expect(await repo.findProjectForWorkflowRun(run.id)).toBeNull();
  });

  it("5: a workflow run linked to a project with createdBy null returns null", async () => {
    const { run } = await seedProjectWithRun({ createdBy: null, organizationId: ORG_A });
    const system = getSystemPersistenceContainer();
    const repo = createInMemoryWorkflowResumeRepository(system, USER_A);

    expect(await repo.findProjectForWorkflowRun(run.id)).toBeNull();
  });

  it("6: a workflow run linked to a project with organizationId null returns null", async () => {
    const { run } = await seedProjectWithRun({ createdBy: USER_A, organizationId: null });
    const system = getSystemPersistenceContainer();
    const repo = createInMemoryWorkflowResumeRepository(system, USER_A);

    expect(await repo.findProjectForWorkflowRun(run.id)).toBeNull();
  });

  it("7: a nonexistent workflowRunId returns null", async () => {
    const system = getSystemPersistenceContainer();
    const repo = createInMemoryWorkflowResumeRepository(system, USER_A);

    expect(await repo.findProjectForWorkflowRun("run_does_not_exist")).toBeNull();
  });

  it("8: a workflow run whose project record is missing returns null", async () => {
    const system = getSystemPersistenceContainer();
    const run = await system.workflowRuns.create({
      id: workflowRunId(),
      projectId: "proj_does_not_exist",
      pipelineId: "ceo_orchestrated",
      status: "queued",
      progress: 0,
    });
    const repo = createInMemoryWorkflowResumeRepository(system, USER_A);

    expect(await repo.findProjectForWorkflowRun(run.id)).toBeNull();
  });

  it("9: the result contains exactly workflowRunId, projectId, organizationId", async () => {
    const { run } = await seedProjectWithRun({ createdBy: USER_A, organizationId: ORG_A });
    const system = getSystemPersistenceContainer();
    const repo = createInMemoryWorkflowResumeRepository(system, USER_A);

    const result = await repo.findProjectForWorkflowRun(run.id);

    expect(result && Object.keys(result).sort()).toEqual(["organizationId", "projectId", "workflowRunId"]);
    expect(result && "userId" in result).toBe(false);
    expect(result && "createdBy" in result).toBe(false);
    expect(result && "status" in result).toBe(false);
    expect(result && "metadata" in result).toBe(false);
    expect(result && "idea" in result).toBe(false);
  });

  it("10: the lookup performs no repository mutation", async () => {
    const { run } = await seedProjectWithRun({ createdBy: USER_A, organizationId: ORG_A });
    const system = getSystemPersistenceContainer();
    const projectsUpdateSpy = vi.spyOn(system.projects, "update");
    const workflowRunsUpdateSpy = vi.spyOn(system.workflowRuns, "update");
    const workflowRunsCreateSpy = vi.spyOn(system.workflowRuns, "create");
    const repo = createInMemoryWorkflowResumeRepository(system, USER_A);

    await repo.findProjectForWorkflowRun(run.id);

    expect(projectsUpdateSpy).not.toHaveBeenCalled();
    expect(workflowRunsUpdateSpy).not.toHaveBeenCalled();
    expect(workflowRunsCreateSpy).not.toHaveBeenCalled();
  });
});
