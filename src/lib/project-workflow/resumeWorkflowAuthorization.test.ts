import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VerifiedWorkflowResumeHandoff } from "./service";
import type { ResumeWorkflowInput, ResumeResult } from "../../ai/reliability";

// --- Local typed adapters around not-yet-existing/changed production exports.
// These exist purely so this RED test file can compile against the FUTURE
// two-argument resumeWorkflow signature and the not-yet-exported
// WorkflowResumeAuthorizationError class, without editing production code.
type FutureResumeWorkflow = (
  handoff: VerifiedWorkflowResumeHandoff,
  input: Omit<ResumeWorkflowInput, "workflowRunId">,
) => Promise<ResumeResult>;

type WorkflowResumeAuthorizationErrorConstructor = new () => Error;

const {
  providerManagerMock,
  getSystemPersistenceContainerMock,
  getPersistenceContainerMock,
  getRequestPersistenceContainerMock,
} = vi.hoisted(() => ({
  providerManagerMock: new Proxy(
    {},
    {
      get: () => vi.fn(),
    },
  ),
  getSystemPersistenceContainerMock: vi.fn(),
  getPersistenceContainerMock: vi.fn(),
  getRequestPersistenceContainerMock: vi.fn(),
}));

vi.mock("../../ai/providers/manager", () => ({
  globalProviderManager: providerManagerMock,
}));

vi.mock("../persistence/setup", () => ({
  getSystemPersistenceContainer: getSystemPersistenceContainerMock,
  getPersistenceContainer: getPersistenceContainerMock,
  getRequestPersistenceContainer: getRequestPersistenceContainerMock,
}));

import * as serviceModule from "./service";

const resumeWorkflow = serviceModule.resumeWorkflow as unknown as FutureResumeWorkflow;
const WorkflowResumeAuthorizationErrorClass = (
  serviceModule as unknown as { WorkflowResumeAuthorizationError?: WorkflowResumeAuthorizationErrorConstructor }
).WorkflowResumeAuthorizationError;

const USER_PROJECT_ID = "proj-resume-system-a";
const OTHER_PROJECT_ID = "proj-resume-system-b";
const WORKFLOW_RUN_ID = "run-resume-system-a";
const ORG_A = "org-resume-system-a";
const ORG_B = "org-resume-system-b";
const fixedIso = "2026-08-02T00:00:00.000Z";

const validHandoff: VerifiedWorkflowResumeHandoff = {
  workflowRunId: WORKFLOW_RUN_ID,
  projectId: USER_PROJECT_ID,
  organizationId: ORG_A,
};

const validInput: Omit<ResumeWorkflowInput, "workflowRunId"> = {
  requestId: "request-resume-system-a",
  checkpointVersion: 3,
  values: { answer: "approved" },
};

function makeProject(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: USER_PROJECT_ID,
    name: "Resume System Test Project",
    idea: "A valid idea for resume system trust-boundary tests.",
    metadata: {},
    status: "running",
    activePipelineId: "ceo_orchestrated",
    organizationId: ORG_A,
    createdBy: "user-resume-system-a",
    createdAt: fixedIso,
    updatedAt: fixedIso,
    completedAt: null,
    errorCode: null,
    sanitizedErrorMessage: null,
    ...overrides,
  };
}

function makeWorkflowRun(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: WORKFLOW_RUN_ID,
    projectId: USER_PROJECT_ID,
    pipelineId: "ceo_orchestrated",
    status: "running",
    progress: 50,
    startedAt: fixedIso,
    completedAt: null,
    createdAt: fixedIso,
    updatedAt: fixedIso,
    ...overrides,
  };
}

function makeCheckpoint(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    workflowRunId: WORKFLOW_RUN_ID,
    projectId: USER_PROJECT_ID,
    currentTaskId: `${WORKFLOW_RUN_ID}:task_mr`,
    workflowStatus: "waiting_for_user",
    taskStatus: "waiting_for_user",
    completedTaskIds: [],
    pendingTaskIds: [`${WORKFLOW_RUN_ID}:task_mr`],
    dependencyState: {},
    attemptCounters: {},
    executionContext: {},
    userInputRequest: {
      requestId: "checkpoint-mismatched-request-id",
      workflowRunId: WORKFLOW_RUN_ID,
      taskId: `${WORKFLOW_RUN_ID}:task_mr`,
      agentId: "market_research",
      question: "Please clarify target market.",
      context: "Need more detail.",
      requiredFields: [],
      createdAt: fixedIso,
    },
    requestId: "checkpoint-mismatched-request-id",
    checkpointVersion: 3,
    requestConsumedAt: null,
    createdAt: fixedIso,
    updatedAt: fixedIso,
    ...overrides,
  };
}

function createFakeSystemContainer() {
  return {
    provider: "memory" as const,
    projects: {
      getById: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
    },
    workflowRuns: {
      getById: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      listByProject: vi.fn(),
      getLatestByProject: vi.fn(),
    },
    workflowTasks: {
      upsert: vi.fn(),
      getById: vi.fn(),
      listByRun: vi.fn(),
    },
    attempts: {
      create: vi.fn(),
      update: vi.fn(),
      listByTask: vi.fn(),
    },
    checkpoints: {
      getActiveByWorkflowRunId: vi.fn(),
      consumeRequest: vi.fn(),
      upsert: vi.fn(),
      clear: vi.fn(),
    },
    artifacts: {
      save: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    },
  };
}

type FakeSystemContainer = ReturnType<typeof createFakeSystemContainer>;

function expectZeroMutations(system: FakeSystemContainer) {
  expect(system.checkpoints.consumeRequest).not.toHaveBeenCalled();
  expect(system.checkpoints.upsert).not.toHaveBeenCalled();
  expect(system.projects.update).not.toHaveBeenCalled();
  expect(system.workflowRuns.update).not.toHaveBeenCalled();
  expect(system.workflowTasks.upsert).not.toHaveBeenCalled();
  expect(system.attempts.create).not.toHaveBeenCalled();
  expect(system.attempts.update).not.toHaveBeenCalled();
  expect(system.artifacts.save).not.toHaveBeenCalled();
}

let system: FakeSystemContainer;

beforeEach(() => {
  vi.clearAllMocks();
  system = createFakeSystemContainer();
  getSystemPersistenceContainerMock.mockReturnValue(system);
  getPersistenceContainerMock.mockReturnValue(system);
});

describe("resumeWorkflow — system-side trust boundary (RED)", () => {
  describe("C: stable authorization error", () => {
    it("exports a real WorkflowResumeAuthorizationError class with name/message/instanceof Error", () => {
      expect(typeof WorkflowResumeAuthorizationErrorClass).toBe("function");
      const error = new (WorkflowResumeAuthorizationErrorClass as WorkflowResumeAuthorizationErrorConstructor)();
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("WorkflowResumeAuthorizationError");
      expect(error.message).toBe("Workflow resume authorization failed.");
    });
  });

  describe("D: system re-check ordering", () => {
    it("1: calls getSystemPersistenceContainer exactly once", async () => {
      system.projects.getById.mockResolvedValue(makeProject());
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun());
      system.checkpoints.getActiveByWorkflowRunId.mockResolvedValue(makeCheckpoint());

      await resumeWorkflow(validHandoff, validInput).catch(() => undefined);

      expect(getSystemPersistenceContainerMock).toHaveBeenCalledTimes(1);
    });

    it("2: never calls getPersistenceContainer or getRequestPersistenceContainer", async () => {
      system.projects.getById.mockResolvedValue(makeProject());
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun());
      system.checkpoints.getActiveByWorkflowRunId.mockResolvedValue(makeCheckpoint());

      await resumeWorkflow(validHandoff, validInput).catch(() => undefined);

      expect(getPersistenceContainerMock).not.toHaveBeenCalled();
      expect(getRequestPersistenceContainerMock).not.toHaveBeenCalled();
    });

    it("3: reads projects.getById(handoff.projectId) before workflowRuns.getById(handoff.workflowRunId)", async () => {
      system.projects.getById.mockResolvedValue(makeProject());
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun());
      system.checkpoints.getActiveByWorkflowRunId.mockResolvedValue(makeCheckpoint());

      await resumeWorkflow(validHandoff, validInput).catch(() => undefined);

      const projectsOrder = system.projects.getById.mock.invocationCallOrder[0];
      const workflowRunsOrder = system.workflowRuns.getById.mock.invocationCallOrder[0];
      expect(projectsOrder).toBeDefined();
      expect(workflowRunsOrder).toBeDefined();
      expect(projectsOrder!).toBeLessThan(workflowRunsOrder!);
    });

    it("4: project and workflow-run validation occur before checkpoints.getActiveByWorkflowRunId", async () => {
      system.projects.getById.mockResolvedValue(makeProject());
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun());
      system.checkpoints.getActiveByWorkflowRunId.mockResolvedValue(makeCheckpoint());

      await resumeWorkflow(validHandoff, validInput).catch(() => undefined);

      const projectsOrder = system.projects.getById.mock.invocationCallOrder[0];
      const workflowRunsOrder = system.workflowRuns.getById.mock.invocationCallOrder[0];
      const checkpointOrder = system.checkpoints.getActiveByWorkflowRunId.mock.invocationCallOrder[0];

      expect(checkpointOrder).toBeDefined();
      expect(projectsOrder!).toBeLessThan(checkpointOrder!);
      expect(workflowRunsOrder!).toBeLessThan(checkpointOrder!);
    });
  });

  describe("E: project verification failures", () => {
    it("5: missing project throws WorkflowResumeAuthorizationError and stops before workflowRuns.getById/checkpoints/writes/execution", async () => {
      system.projects.getById.mockResolvedValue(null);
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun());

      await expect(resumeWorkflow(validHandoff, validInput)).rejects.toBeInstanceOf(WorkflowResumeAuthorizationErrorClass);

      expect(system.workflowRuns.getById).not.toHaveBeenCalled();
      expect(system.checkpoints.getActiveByWorkflowRunId).not.toHaveBeenCalled();
      expectZeroMutations(system);
    });

    it("6: project.organizationId === null throws before workflow-run lookup", async () => {
      system.projects.getById.mockResolvedValue(makeProject({ organizationId: null }));
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun());

      await expect(resumeWorkflow(validHandoff, validInput)).rejects.toBeInstanceOf(WorkflowResumeAuthorizationErrorClass);

      expect(system.workflowRuns.getById).not.toHaveBeenCalled();
      expectZeroMutations(system);
    });

    it("7: project.organizationId !== handoff.organizationId throws before workflow-run lookup", async () => {
      system.projects.getById.mockResolvedValue(makeProject({ organizationId: ORG_B }));
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun());

      await expect(resumeWorkflow(validHandoff, validInput)).rejects.toBeInstanceOf(WorkflowResumeAuthorizationErrorClass);

      expect(system.workflowRuns.getById).not.toHaveBeenCalled();
      expectZeroMutations(system);
    });

    it("8: organization comparison is exact and case-sensitive", async () => {
      system.projects.getById.mockResolvedValue(makeProject({ organizationId: "org-resume-system-a" }));
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun());

      const caseMismatchedHandoff: VerifiedWorkflowResumeHandoff = {
        ...validHandoff,
        organizationId: "ORG-RESUME-SYSTEM-A",
      };

      await expect(resumeWorkflow(caseMismatchedHandoff, validInput)).rejects.toBeInstanceOf(WorkflowResumeAuthorizationErrorClass);
      expectZeroMutations(system);
    });
  });

  describe("F: workflow-run verification failures", () => {
    it("9: missing workflow run throws WorkflowResumeAuthorizationError before checkpoint access", async () => {
      system.projects.getById.mockResolvedValue(makeProject());
      system.workflowRuns.getById.mockResolvedValue(null);

      await expect(resumeWorkflow(validHandoff, validInput)).rejects.toBeInstanceOf(WorkflowResumeAuthorizationErrorClass);

      expect(system.checkpoints.getActiveByWorkflowRunId).not.toHaveBeenCalled();
      expectZeroMutations(system);
    });

    it("10: a workflow run whose projectId does not equal handoff.projectId throws before checkpoint access", async () => {
      system.projects.getById.mockResolvedValue(makeProject());
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun({ projectId: OTHER_PROJECT_ID }));

      await expect(resumeWorkflow(validHandoff, validInput)).rejects.toBeInstanceOf(WorkflowResumeAuthorizationErrorClass);

      expect(system.checkpoints.getActiveByWorkflowRunId).not.toHaveBeenCalled();
      expectZeroMutations(system);
    });

    it("11: the workflow-run/project comparison is exact and case-sensitive", async () => {
      system.projects.getById.mockResolvedValue(makeProject({ id: USER_PROJECT_ID }));
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun({ projectId: USER_PROJECT_ID.toUpperCase() }));

      await expect(resumeWorkflow(validHandoff, validInput)).rejects.toBeInstanceOf(WorkflowResumeAuthorizationErrorClass);
      expectZeroMutations(system);
    });
  });

  describe("G: domain-error ordering after authorization", () => {
    it("12: a fully matching tenant relationship proceeds past authorization and throws the existing ResumeRequestMismatchError", async () => {
      system.projects.getById.mockResolvedValue(makeProject());
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun());
      system.checkpoints.getActiveByWorkflowRunId.mockResolvedValue(makeCheckpoint());

      await expect(resumeWorkflow(validHandoff, validInput)).rejects.toMatchObject({ name: "ResumeRequestMismatchError" });

      expect(system.checkpoints.getActiveByWorkflowRunId).toHaveBeenCalled();
      expectZeroMutations(system);
    });

    it("13: the same mismatched checkpoint with an invalid organization handoff must reject via WorkflowResumeAuthorizationError before checkpoint lookup, not ResumeRequestMismatchError", async () => {
      system.projects.getById.mockResolvedValue(makeProject({ organizationId: ORG_A }));
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun());
      system.checkpoints.getActiveByWorkflowRunId.mockResolvedValue(makeCheckpoint());

      const invalidOrgHandoff: VerifiedWorkflowResumeHandoff = { ...validHandoff, organizationId: ORG_B };

      await expect(resumeWorkflow(invalidOrgHandoff, validInput)).rejects.toBeInstanceOf(WorkflowResumeAuthorizationErrorClass);

      expect(system.checkpoints.getActiveByWorkflowRunId).not.toHaveBeenCalled();
      expectZeroMutations(system);
    });
  });

  describe("H: identifier integrity", () => {
    it("14: system lookups use only handoff identifiers; an attacker-supplied workflowRunId on the input is ignored", async () => {
      system.projects.getById.mockResolvedValue(makeProject());
      system.workflowRuns.getById.mockResolvedValue(makeWorkflowRun());
      system.checkpoints.getActiveByWorkflowRunId.mockResolvedValue(makeCheckpoint());

      const maliciousInput = {
        workflowRunId: "run-attacker-controlled",
        requestId: validInput.requestId,
        checkpointVersion: validInput.checkpointVersion,
        values: validInput.values,
      } as unknown as Omit<ResumeWorkflowInput, "workflowRunId">;

      await resumeWorkflow(validHandoff, maliciousInput).catch(() => undefined);

      for (const call of system.projects.getById.mock.calls) {
        expect(call[0]).not.toBe("run-attacker-controlled");
      }
      for (const call of system.workflowRuns.getById.mock.calls) {
        expect(call[0]).not.toBe("run-attacker-controlled");
      }
      for (const call of system.checkpoints.getActiveByWorkflowRunId.mock.calls) {
        expect(call[0]).not.toBe("run-attacker-controlled");
      }
      expect(system.checkpoints.consumeRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ workflowRunId: "run-attacker-controlled" }),
      );
    });
  });
});
