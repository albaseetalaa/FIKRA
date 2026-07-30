import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => {
  class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication required.");
      this.name = "AuthenticationRequiredError";
    }
  }

  return {
    AuthenticationRequiredError,
    requireAuthenticatedUserMock: vi.fn(),
  };
});

const serviceMocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  getProjectStatus: vi.fn(),
  listProjectHistory: vi.fn(),
  resumeWorkflow: vi.fn(),
  startBusinessStrategistExecution: vi.fn(),
}));

vi.mock("@/ai/reliability", () => {
  class ResumeRequestAlreadyConsumedError extends Error {}
  class ResumeRequestMismatchError extends Error {}
  class ResumeValidationError extends Error {}
  class StaleCheckpointError extends Error {}
  class WorkflowNotPausedError extends Error {}

  return {
    ResumeRequestAlreadyConsumedError,
    ResumeRequestMismatchError,
    ResumeValidationError,
    StaleCheckpointError,
    WorkflowNotPausedError,
  };
});

vi.mock("@/lib/project-workflow/resumeContract", () => ({
  resumeRequestBodySchema: {
    parse: vi.fn((value: unknown) => value),
  },
  resumeResponseSchema: {
    parse: vi.fn((value: unknown) => value),
  },
}));
vi.mock("@/lib/auth/requireAuthenticatedUser", () => ({
  AuthenticationRequiredError: authMocks.AuthenticationRequiredError,
  requireAuthenticatedUser: authMocks.requireAuthenticatedUserMock,
}));

vi.mock("@/lib/project-workflow/service", () => serviceMocks);

import { POST as createProject } from "./projects/create/route";
import { GET as getProjectHistory } from "./projects/history/route";
import { POST as startProject } from "./projects/start/route";
import { GET as getProjectStatus } from "./projects/status/[projectId]/route";
import { POST as resumeWorkflow } from "./workflows/[workflowRunId]/resume/route";

async function expectUnauthorized(
  responsePromise: Promise<Response>,
): Promise<void> {
  const response = await responsePromise;

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: "Authentication required.",
  });
}

function expectNoServiceCalls(): void {
  for (const serviceMock of Object.values(serviceMocks)) {
    expect(serviceMock).not.toHaveBeenCalled();
  }
}

describe("API authentication boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authMocks.requireAuthenticatedUserMock.mockRejectedValue(
      new authMocks.AuthenticationRequiredError(),
    );
  });

  it("protects project creation before reading its request body", async () => {
    await expectUnauthorized(
      createProject(
        new Request("https://fikra.test/api/projects/create", {
          method: "POST",
        }),
      ),
    );

    expectNoServiceCalls();
  });

  it("protects project history", async () => {
    await expectUnauthorized(getProjectHistory());

    expectNoServiceCalls();
  });

  it("protects project execution start before reading its request body", async () => {
    await expectUnauthorized(
      startProject(
        new Request("https://fikra.test/api/projects/start", {
          method: "POST",
        }),
      ),
    );

    expectNoServiceCalls();
  });

  it("protects project status", async () => {
    await expectUnauthorized(
      getProjectStatus(
        new Request(
          "https://fikra.test/api/projects/status/proj_test_1",
        ),
        {
          params: Promise.resolve({
            projectId: "proj_test_1",
          }),
        },
      ),
    );

    expectNoServiceCalls();
  });

  it("protects workflow resume before reading its request body", async () => {
    await expectUnauthorized(
      resumeWorkflow(
        new Request(
          "https://fikra.test/api/workflows/run_test_1/resume",
          {
            method: "POST",
          },
        ),
        {
          params: Promise.resolve({
            workflowRunId: "run_test_1",
          }),
        },
      ),
    );

    expectNoServiceCalls();
  });
});
