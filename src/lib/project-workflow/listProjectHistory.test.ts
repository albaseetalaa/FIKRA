import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSystemPersistenceContainer, resetPersistenceContainerForTests } from "../persistence/setup";
import { listProjectHistory } from "./service";

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
  vi.useRealTimers();
});

function projectId() {
  return `proj_${Math.random().toString(36).slice(2, 10)}`;
}

async function seedProject(overrides: { id?: string; createdBy?: string | null; name?: string } = {}) {
  const system = getSystemPersistenceContainer();
  return system.projects.create({
    id: overrides.id ?? projectId(),
    name: overrides.name ?? "Seed Project",
    idea: "Seed idea for project history tests.",
    activePipelineId: "business_strategist_only",
    organizationId: null,
    createdBy: overrides.createdBy ?? null,
  });
}

describe("listProjectHistory", () => {
  it("1: user-a receives only projects with createdBy === user-a", async () => {
    const a1 = await seedProject({ createdBy: "user-a" });
    await seedProject({ createdBy: "user-b" });

    const items = await listProjectHistory({ userId: "user-a" });

    expect(items.map((i) => i.id)).toEqual([a1.id]);
  });

  it("2: user-b receives only projects with createdBy === user-b", async () => {
    await seedProject({ createdBy: "user-a" });
    const b1 = await seedProject({ createdBy: "user-b" });

    const items = await listProjectHistory({ userId: "user-b" });

    expect(items.map((i) => i.id)).toEqual([b1.id]);
  });

  it("3: projects with createdBy null are hidden", async () => {
    await seedProject({ createdBy: null });

    const items = await listProjectHistory({ userId: "user-a" });

    expect(items).toEqual([]);
  });

  it("4: preserves createdAt-descending ordering", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T10:00:00.000Z"));
    const older = await seedProject({ createdBy: "user-a" });
    vi.setSystemTime(new Date("2026-08-01T10:00:01.000Z"));
    const newer = await seedProject({ createdBy: "user-a" });
    vi.useRealTimers();

    const items = await listProjectHistory({ userId: "user-a" });

    expect(items.map((i) => i.id)).toEqual([newer.id, older.id]);
  });

  it("5: limit is applied to the creator-scoped project list", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T10:00:00.000Z"));
    await seedProject({ createdBy: "user-a" });
    vi.setSystemTime(new Date("2026-08-01T10:00:01.000Z"));
    const second = await seedProject({ createdBy: "user-a" });
    vi.setSystemTime(new Date("2026-08-01T10:00:02.000Z"));
    const third = await seedProject({ createdBy: "user-a" });
    vi.useRealTimers();

    const items = await listProjectHistory({ userId: "user-a" }, 2);

    expect(items.map((i) => i.id)).toEqual([third.id, second.id]);
  });

  it("6: preserves workflowStatus, pausedTaskId, and userInputRequest enrichment for authorized projects", async () => {
    const project = await seedProject({ createdBy: "user-a" });
    const system = getSystemPersistenceContainer();
    const runId = `run_${Math.random().toString(36).slice(2, 10)}`;

    await system.workflowRuns.create({
      id: runId,
      projectId: project.id,
      pipelineId: "business_strategist_only",
      status: "running",
      progress: 40,
    });

    const userInputRequest = {
      requestId: "req_1",
      workflowRunId: runId,
      taskId: `${runId}:task_mr`,
      agentId: "market_research",
      question: "Please clarify target market.",
      context: "Need more detail",
      requiredFields: [],
      createdAt: "2026-08-01T10:00:00.000Z",
    };

    await system.checkpoints.upsert({
      workflowRunId: runId,
      projectId: project.id,
      currentTaskId: `${runId}:task_mr`,
      workflowStatus: "waiting_for_user",
      taskStatus: "waiting_for_user",
      completedTaskIds: [],
      pendingTaskIds: [`${runId}:task_mr`],
      dependencyState: {},
      attemptCounters: {},
      executionContext: {},
      userInputRequest,
      requestId: "req_1",
      checkpointVersion: 1,
      requestConsumedAt: null,
    });

    const items = await listProjectHistory({ userId: "user-a" });
    const item = items.find((i) => i.id === project.id);

    expect(item?.workflowStatus).toBe("waiting_for_user");
    expect(item?.pausedTaskId).toBe(`${runId}:task_mr`);
    expect(item?.userInputRequest).toEqual(userInputRequest);
  });

  it("7: never calls the unscoped system.projects.list", async () => {
    await seedProject({ createdBy: "user-a" });
    const system = getSystemPersistenceContainer();
    const listSpy = vi.spyOn(system.projects, "list");

    await listProjectHistory({ userId: "user-a" });

    expect(listSpy).not.toHaveBeenCalled();
  });

  it("8: only looks up workflow runs/checkpoints for authorized project ids", async () => {
    const ownProject = await seedProject({ createdBy: "user-a" });
    const otherProject = await seedProject({ createdBy: "user-b" });
    const legacyProject = await seedProject({ createdBy: null });

    const system = getSystemPersistenceContainer();
    const getLatestByProjectSpy = vi.spyOn(system.workflowRuns, "getLatestByProject");

    await listProjectHistory({ userId: "user-a" });

    const calledWith = getLatestByProjectSpy.mock.calls.map((call) => call[0]);
    expect(calledWith).toContain(ownProject.id);
    expect(calledWith).not.toContain(otherProject.id);
    expect(calledWith).not.toContain(legacyProject.id);
  });

  it("9: public history items contain only the existing response fields", async () => {
    await seedProject({ createdBy: "user-a" });

    const items = await listProjectHistory({ userId: "user-a" });
    const allowedKeys = [
      "id",
      "name",
      "ideaExcerpt",
      "status",
      "createdAt",
      "updatedAt",
      "workflowStatus",
      "pausedTaskId",
      "userInputRequest",
    ];

    for (const item of items) {
      for (const key of Object.keys(item)) {
        expect(allowedKeys).toContain(key);
      }
      expect("organizationId" in item).toBe(false);
      expect("createdBy" in item).toBe(false);
    }
  });
});
