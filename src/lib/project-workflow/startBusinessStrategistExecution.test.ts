import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSystemPersistenceContainer, resetPersistenceContainerForTests } from "../persistence/setup";
import { globalProviderManager } from "../../ai/providers/manager";
import type AIProvider from "../../ai/providers/interface";
import defaultModels from "../../ai/providers/models";
import { validBusinessPlan, validFinancialModel, validMarketResearchReport } from "../../ai/testing/mocks";
import { ProjectStartAuthorizationError, startBusinessStrategistExecution } from "./service";
import type { VerifiedProjectHandoff } from "./service";

const ORG_A = "org-start-exec-a";
const ORG_B = "org-start-exec-b";

function forceMemoryProvider() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AI_PERSISTENCE_PROVIDER", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
}

function baseResult(output: unknown) {
  return {
    providerId: "openai",
    model: "attempt-model",
    requestId: "req-start-exec-test",
    output,
    usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
    metadata: {
      startedAt: "2026-08-01T00:00:00.000Z",
      completedAt: "2026-08-01T00:00:01.000Z",
      parsedJson: true,
      rawResponseAvailable: true,
      rawResponseTruncated: false,
      refusalDetected: false,
      truncatedDetected: false,
      finishReason: null,
      responseStatus: "completed",
      responseFormat: "json_schema",
      parsingClassification: "native_structured_object",
      parsingStage: "provider_native_parsed",
      incompleteReason: null,
      responseCharLength: 0,
      configuredMaxOutputTokens: 3600,
    },
  };
}

function configuredProviderIds() {
  return new Set<string>([
    defaultModels.business_strategist.provider,
    defaultModels.market_research.provider,
    defaultModels.financial_analyst.provider,
    "openai",
    "structured-stub",
    "mock",
  ]);
}

function registerFakeProviders() {
  const provider: AIProvider = {
    id: "openai",
    name: "start-exec-test-provider",
    async invoke(_prompt, options) {
      if (options?.agentId === "business_strategist") return baseResult(validBusinessPlan);
      if (options?.agentId === "market_research") return baseResult(validMarketResearchReport);
      if (options?.agentId === "financial_analyst") return baseResult(validFinancialModel);
      return baseResult(validFinancialModel);
    },
    async health() {
      return { ok: true };
    },
    async models() {
      return ["attempt-model"];
    },
    async validateConfiguration() {
      return true;
    },
  };

  for (const providerId of configuredProviderIds()) {
    globalProviderManager.register({ ...provider, id: providerId, name: `start-exec-test-${providerId}` });
  }
}

function registerHangingProviders() {
  const provider: AIProvider = {
    id: "openai",
    name: "start-exec-test-hang",
    invoke: () => new Promise(() => {}),
    async health() {
      return { ok: true };
    },
    async models() {
      return ["attempt-model"];
    },
    async validateConfiguration() {
      return true;
    },
  };

  for (const providerId of configuredProviderIds()) {
    globalProviderManager.register({ ...provider, id: providerId, name: `start-exec-test-hang-${providerId}` });
  }
}

beforeEach(() => {
  forceMemoryProvider();
  resetPersistenceContainerForTests();
});

afterEach(() => {
  globalProviderManager.clear();
  resetPersistenceContainerForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function projectId() {
  return `proj_${Math.random().toString(36).slice(2, 10)}`;
}

async function seedProject(overrides: { id?: string; organizationId: string | null; createdBy?: string | null }) {
  const system = getSystemPersistenceContainer();
  return system.projects.create({
    id: overrides.id ?? projectId(),
    name: "Start Execution Test Project",
    idea: "Seed idea for start execution boundary tests.",
    activePipelineId: "ceo_orchestrated",
    organizationId: overrides.organizationId,
    createdBy: overrides.createdBy ?? "user-start-exec",
  });
}

async function seedQueuedWorkflowRun(projectId: string, workflowRunId: string): Promise<void> {
  const system = getSystemPersistenceContainer();

  await system.workflowRuns.create({
    id: workflowRunId,
    projectId,
    pipelineId: "ceo_orchestrated",
    status: "queued",
    progress: 0,
  });
}

async function flush(ms = 30) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("startBusinessStrategistExecution", () => {
  it("1: performs a system projects.getById(handoff.projectId) re-read", async () => {
    const project = await seedProject({ organizationId: ORG_A });
    await seedQueuedWorkflowRun(project.id, "run-fixture-test-1");
    const system = getSystemPersistenceContainer();
    const getByIdSpy = vi.spyOn(system.projects, "getById");
    const handoff: VerifiedProjectHandoff = { projectId: project.id, organizationId: ORG_A };

    registerFakeProviders();
    await startBusinessStrategistExecution(handoff);

    expect(getByIdSpy).toHaveBeenCalledWith(project.id);
  });

  it("2: the system re-read occurs before downstream mutations and lookups", async () => {
    const project = await seedProject({ organizationId: ORG_A });
    await seedQueuedWorkflowRun(project.id, "run-fixture-test-2");
    const system = getSystemPersistenceContainer();
    const handoff: VerifiedProjectHandoff = { projectId: project.id, organizationId: ORG_A };

    const getByIdSpy = vi.spyOn(system.projects, "getById");
    const getLatestByProjectSpy = vi.spyOn(system.workflowRuns, "getLatestByProject");
    const workflowRunsCreateSpy = vi.spyOn(system.workflowRuns, "create");
    const projectsUpdateSpy = vi.spyOn(system.projects, "update");
    const workflowRunsUpdateSpy = vi.spyOn(system.workflowRuns, "update");
    const workflowTasksUpsertSpy = vi.spyOn(system.workflowTasks, "upsert");
    const attemptsCreateSpy = vi.spyOn(system.attempts, "create");
    const checkpointsUpsertSpy = vi.spyOn(system.checkpoints, "upsert");
    const artifactsSaveSpy = vi.spyOn(system.artifacts, "save");

    registerFakeProviders();
    await startBusinessStrategistExecution(handoff);
    await flush();

    const getByIdOrder = getByIdSpy.mock.invocationCallOrder[0];
    expect(getByIdOrder).toBeDefined();

    const laterSpies = [
      getLatestByProjectSpy,
      workflowRunsCreateSpy,
      projectsUpdateSpy,
      workflowRunsUpdateSpy,
      workflowTasksUpsertSpy,
      attemptsCreateSpy,
      checkpointsUpsertSpy,
      artifactsSaveSpy,
    ];

    for (const spy of laterSpies) {
      for (const order of spy.mock.invocationCallOrder) {
        expect(order).toBeGreaterThan(getByIdOrder!);
      }
    }
  });

  it("3: a matching handoff permits the normal execution-start path without throwing", async () => {
    const project = await seedProject({ organizationId: ORG_A });
    await seedQueuedWorkflowRun(project.id, "run-fixture-test-3");
    const handoff: VerifiedProjectHandoff = { projectId: project.id, organizationId: ORG_A };

    registerFakeProviders();
    await expect(startBusinessStrategistExecution(handoff)).resolves.toBeUndefined();

    const system = getSystemPersistenceContainer();
    const run = await system.workflowRuns.getLatestByProject(project.id);
    expect(run).not.toBeNull();
    expect(["queued", "running"]).toContain(run?.status);
  });

  it("4: organization mismatch throws ProjectStartAuthorizationError", async () => {
    const project = await seedProject({ organizationId: ORG_A });
    const handoff: VerifiedProjectHandoff = { projectId: project.id, organizationId: ORG_B };

    await expect(startBusinessStrategistExecution(handoff)).rejects.toBeInstanceOf(ProjectStartAuthorizationError);
  });

  it("5: a missing system project throws ProjectStartAuthorizationError", async () => {
    const handoff: VerifiedProjectHandoff = { projectId: "proj_missing_for_start", organizationId: ORG_A };

    await expect(startBusinessStrategistExecution(handoff)).rejects.toBeInstanceOf(ProjectStartAuthorizationError);
  });

  it("6: mismatch and missing-project cases cause zero mutations and no execution", async () => {
    const project = await seedProject({ organizationId: ORG_A });
    const system = getSystemPersistenceContainer();

    const workflowRunsCreateSpy = vi.spyOn(system.workflowRuns, "create");
    const workflowRunsUpdateSpy = vi.spyOn(system.workflowRuns, "update");
    const workflowTasksUpsertSpy = vi.spyOn(system.workflowTasks, "upsert");
    const attemptsCreateSpy = vi.spyOn(system.attempts, "create");
    const checkpointsUpsertSpy = vi.spyOn(system.checkpoints, "upsert");
    const artifactsSaveSpy = vi.spyOn(system.artifacts, "save");
    const projectsUpdateSpy = vi.spyOn(system.projects, "update");

    const mismatchedHandoff: VerifiedProjectHandoff = { projectId: project.id, organizationId: ORG_B };
    await expect(startBusinessStrategistExecution(mismatchedHandoff)).rejects.toBeInstanceOf(ProjectStartAuthorizationError);

    const missingHandoff: VerifiedProjectHandoff = { projectId: "proj_missing_for_start_2", organizationId: ORG_A };
    await expect(startBusinessStrategistExecution(missingHandoff)).rejects.toBeInstanceOf(ProjectStartAuthorizationError);

    expect(workflowRunsCreateSpy).not.toHaveBeenCalled();
    expect(workflowRunsUpdateSpy).not.toHaveBeenCalled();
    expect(workflowTasksUpsertSpy).not.toHaveBeenCalled();
    expect(attemptsCreateSpy).not.toHaveBeenCalled();
    expect(checkpointsUpsertSpy).not.toHaveBeenCalled();
    expect(artifactsSaveSpy).not.toHaveBeenCalled();
    expect(projectsUpdateSpy).not.toHaveBeenCalled();
  });

  it("7: the organization comparison is exact and case-sensitive", async () => {
    const project = await seedProject({ organizationId: "org-Start-A" });
    const differentCaseHandoff: VerifiedProjectHandoff = { projectId: project.id, organizationId: "org-start-a" };

    await expect(startBusinessStrategistExecution(differentCaseHandoff)).rejects.toBeInstanceOf(ProjectStartAuthorizationError);
  });

  it("8: the handoff's projectId is the only identifier used for the system project re-read", async () => {
    const project = await seedProject({ organizationId: ORG_A });
    await seedQueuedWorkflowRun(project.id, "run-fixture-test-8");
    const system = getSystemPersistenceContainer();
    const getByIdSpy = vi.spyOn(system.projects, "getById");
    const handoff: VerifiedProjectHandoff = { projectId: project.id, organizationId: ORG_A };

    registerFakeProviders();
    await startBusinessStrategistExecution(handoff);

    for (const call of getByIdSpy.mock.calls) {
      expect(call[0]).toBe(project.id);
    }
    expect(getByIdSpy).toHaveBeenCalledWith(project.id);
  });

  it("9: system validation occurs before the runningProjects dedup path", async () => {
    const project = await seedProject({ organizationId: ORG_A });
    await seedQueuedWorkflowRun(project.id, "run-fixture-test-9");

    // A never-resolving provider keeps the background execution — and
    // therefore any internal "already running" bookkeeping for this
    // project id — alive for the duration of this test, without needing
    // direct access to production-internal state.
    registerHangingProviders();

    const validHandoff: VerifiedProjectHandoff = { projectId: project.id, organizationId: ORG_A };
    await startBusinessStrategistExecution(validHandoff);

    const forgedHandoff: VerifiedProjectHandoff = { projectId: project.id, organizationId: ORG_B };
    await expect(startBusinessStrategistExecution(forgedHandoff)).rejects.toBeInstanceOf(ProjectStartAuthorizationError);
  });

  it("10: repeated start calls for the same still-running project never create a second workflow run", async () => {
    const project = await seedProject({ organizationId: ORG_A });
    await seedQueuedWorkflowRun(project.id, "run-fixture-test-10");
    const system = getSystemPersistenceContainer();
    const workflowRunsCreateSpy = vi.spyOn(system.workflowRuns, "create");
    const handoff: VerifiedProjectHandoff = { projectId: project.id, organizationId: ORG_A };

    registerHangingProviders();

    await startBusinessStrategistExecution(handoff);
    await startBusinessStrategistExecution(handoff);
    await startBusinessStrategistExecution(handoff);

    expect(workflowRunsCreateSpy).not.toHaveBeenCalled();

    const runs = await system.workflowRuns.listByProject(project.id);
    expect(runs).toHaveLength(1);
  });
});
