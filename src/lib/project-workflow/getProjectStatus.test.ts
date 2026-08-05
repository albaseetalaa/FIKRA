import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSystemPersistenceContainer, resetPersistenceContainerForTests } from "../persistence/setup";
import { getProjectStatus } from "./service";

const USER_A = "user-status-a";
const USER_B = "user-status-b";

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

async function seedProject(overrides: { id?: string; createdBy?: string | null; name?: string } = {}) {
  const system = getSystemPersistenceContainer();
  return system.projects.create({
    id: overrides.id ?? projectId(),
    name: overrides.name ?? "Status Test Project",
    idea: "Seed idea for project status tests.",
    activePipelineId: "ceo_orchestrated",
    organizationId: "org-status-test",
    createdBy: overrides.createdBy ?? null,
  });
}

describe("getProjectStatus", () => {
  it("1: user A can read user A's project status", async () => {
    const project = await seedProject({ createdBy: USER_A });

    const status = await getProjectStatus({ userId: USER_A }, project.id);

    expect(status?.projectId).toBe(project.id);
  });

  it("2: user B can read user B's project status", async () => {
    const project = await seedProject({ createdBy: USER_B });

    const status = await getProjectStatus({ userId: USER_B }, project.id);

    expect(status?.projectId).toBe(project.id);
  });

  it("3: user A receives null for user B's project", async () => {
    const project = await seedProject({ createdBy: USER_B });

    const status = await getProjectStatus({ userId: USER_A }, project.id);

    expect(status).toBeNull();
  });

  it("4: user B receives null for user A's project", async () => {
    const project = await seedProject({ createdBy: USER_A });

    const status = await getProjectStatus({ userId: USER_B }, project.id);

    expect(status).toBeNull();
  });

  it("5: a project with createdBy null is inaccessible", async () => {
    const project = await seedProject({ createdBy: null });

    const status = await getProjectStatus({ userId: USER_A }, project.id);

    expect(status).toBeNull();
  });

  it("6: a nonexistent project and a cross-creator project both return exactly null", async () => {
    const crossCreatorProject = await seedProject({ createdBy: USER_B });

    const nonexistentResult = await getProjectStatus({ userId: USER_A }, "proj_does_not_exist");
    const crossCreatorResult = await getProjectStatus({ userId: USER_A }, crossCreatorProject.id);

    expect(nonexistentResult).toBeNull();
    expect(crossCreatorResult).toBeNull();
  });

  it("7: the initial authorization lookup never uses the unscoped system project repository", async () => {
    const project = await seedProject({ createdBy: USER_A });
    const system = getSystemPersistenceContainer();
    const getByIdSpy = vi.spyOn(system.projects, "getById");
    const listSpy = vi.spyOn(system.projects, "list");

    await getProjectStatus({ userId: USER_A }, project.id);

    expect(getByIdSpy).not.toHaveBeenCalled();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it("8a: no enrichment lookups occur for a cross-creator project", async () => {
    const project = await seedProject({ createdBy: USER_B });
    const system = getSystemPersistenceContainer();
    const workflowRunsSpy = vi.spyOn(system.workflowRuns, "getLatestByProject");
    const artifactsSpy = vi.spyOn(system.artifacts, "list");
    const checkpointsSpy = vi.spyOn(system.checkpoints, "getActiveByWorkflowRunId");

    await getProjectStatus({ userId: USER_A }, project.id);

    expect(workflowRunsSpy).not.toHaveBeenCalled();
    expect(artifactsSpy).not.toHaveBeenCalled();
    expect(checkpointsSpy).not.toHaveBeenCalled();
  });

  it("8b: no enrichment lookups occur for a legacy createdBy-null project", async () => {
    const project = await seedProject({ createdBy: null });
    const system = getSystemPersistenceContainer();
    const workflowRunsSpy = vi.spyOn(system.workflowRuns, "getLatestByProject");
    const artifactsSpy = vi.spyOn(system.artifacts, "list");
    const checkpointsSpy = vi.spyOn(system.checkpoints, "getActiveByWorkflowRunId");

    await getProjectStatus({ userId: USER_A }, project.id);

    expect(workflowRunsSpy).not.toHaveBeenCalled();
    expect(artifactsSpy).not.toHaveBeenCalled();
    expect(checkpointsSpy).not.toHaveBeenCalled();
  });

  it("8c: no enrichment lookups occur for a nonexistent project", async () => {
    const system = getSystemPersistenceContainer();
    const workflowRunsSpy = vi.spyOn(system.workflowRuns, "getLatestByProject");
    const artifactsSpy = vi.spyOn(system.artifacts, "list");
    const checkpointsSpy = vi.spyOn(system.checkpoints, "getActiveByWorkflowRunId");

    await getProjectStatus({ userId: USER_A }, "proj_does_not_exist");

    expect(workflowRunsSpy).not.toHaveBeenCalled();
    expect(artifactsSpy).not.toHaveBeenCalled();
    expect(checkpointsSpy).not.toHaveBeenCalled();
  });

  it("9: an authorized owned project preserves the existing successful status enrichment and response shape", async () => {
    const project = await seedProject({ createdBy: USER_A, name: "Eggreen" });
    const system = getSystemPersistenceContainer();
    const runId = `run_${Math.random().toString(36).slice(2, 10)}`;

    await system.workflowRuns.create({
      id: runId,
      projectId: project.id,
      pipelineId: "ceo_orchestrated",
      status: "running",
      progress: 66,
    });

    await system.artifacts.save({
      projectId: project.id,
      workflowRunId: runId,
      agentId: "business_strategist",
      pipelineId: "ceo_orchestrated",
      outputType: "BusinessPlan",
      content: {
        businessVertical: "restaurant_food_service",
        revenueModel: "transaction_sales",
        generatedAt: "2026-08-01T00:00:00.000Z",
        contextVersion: "1.0.0",
      },
      validationStatus: "valid",
      schemaVersion: 1,
      artifactVersion: 1,
      version: 1,
    });

    await system.artifacts.save({
      projectId: project.id,
      workflowRunId: runId,
      agentId: "market_research",
      pipelineId: "ceo_orchestrated",
      outputType: "MarketResearchReport",
      content: {
        summary: "Market summary",
        competitorDataStatus: "unavailable",
        unavailableCompetitorOutcome: {
          competitorDataStatus: "unavailable",
          competitorCategoriesToInvestigate: ["quick_service_restaurants"],
          requiredResearchActions: ["Field mapping"],
          suggestedSearchQueries: ["healthy breakfast amman"],
          comparisonCriteria: ["price"],
        },
      },
      validationStatus: "valid",
      schemaVersion: 1,
      artifactVersion: 1,
      version: 1,
    });

    await system.artifacts.save({
      projectId: project.id,
      workflowRunId: runId,
      agentId: "financial_analyst",
      pipelineId: "ceo_orchestrated",
      outputType: "FinancialModel",
      content: {
        verticalId: "restaurant_food_service",
        revenueModelType: "transaction_sales",
        generatedAt: "2026-08-01T00:00:00.000Z",
      },
      validationStatus: "valid",
      schemaVersion: 1,
      artifactVersion: 1,
      version: 1,
    });

    const userInputRequest = {
      requestId: "req_status_test",
      workflowRunId: runId,
      taskId: `${runId}:task_mr`,
      agentId: "market_research",
      question: "Please clarify target market.",
      context: "Need more detail",
      requiredFields: [],
      createdAt: "2026-08-01T00:00:00.000Z",
    };

    await system.checkpoints.upsert({
      workflowRunId: runId,
      projectId: project.id,
      currentTaskId: `${runId}:task_mr`,
      workflowStatus: "waiting_for_user",
      taskStatus: "waiting_for_user",
      completedTaskIds: [`${runId}:task_bs`],
      pendingTaskIds: [`${runId}:task_mr`],
      dependencyState: {},
      attemptCounters: {},
      executionContext: {},
      userInputRequest,
      requestId: "req_status_test",
      checkpointVersion: 1,
      requestConsumedAt: null,
    });

    const status = await getProjectStatus({ userId: USER_A }, project.id);

    expect(status).not.toBeNull();
    expect(status?.projectId).toBe(project.id);
    expect(status?.name).toBe("Eggreen");
    expect(status?.workflowStatus).toBe("waiting_for_user");
    expect(status?.pausedTaskId).toBe(`${runId}:task_mr`);
    expect(status?.userInputRequest).toEqual(userInputRequest);
    expect(status?.projectScore ?? null).toBeNull();
    expect(Array.isArray(status?.capabilities)).toBe(true);
  });

  it("10: the returned ProjectStatusView does not expose organizationId or createdBy", async () => {
    const project = await seedProject({ createdBy: USER_A });

    const status = await getProjectStatus({ userId: USER_A }, project.id);

    expect(status).not.toBeNull();
    expect(status && "organizationId" in status).toBe(false);
    expect(status && "createdBy" in status).toBe(false);
  });
});
