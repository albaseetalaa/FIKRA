import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAuthenticatedUserMock, AuthenticationRequiredErrorMock } = vi.hoisted(() => {
  class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication required.");
      this.name = "AuthenticationRequiredError";
    }
  }

  return {
    AuthenticationRequiredErrorMock: AuthenticationRequiredError,
    requireAuthenticatedUserMock: vi.fn(async () => ({ id: "user_test_1" })),
  };
});

vi.mock("@/lib/auth/requireAuthenticatedUser", () => ({
  AuthenticationRequiredError: AuthenticationRequiredErrorMock,
  requireAuthenticatedUser: requireAuthenticatedUserMock,
}));

const { createProjectMock } = vi.hoisted(() => ({
  createProjectMock: vi.fn(async (_input: unknown, _executor: unknown) => ({
    projectId: "proj_test_1",
    status: "queued",
    workflowRunId: "run_test_1",
  })),
}));

vi.mock("@/lib/project-workflow/service", () => ({
  createProject: createProjectMock,
}));

const { executeCreateProjectRpcMock, ProjectCreationValidationErrorMock, ProjectCreationPersistenceErrorMock } = vi.hoisted(() => {
  class ProjectCreationValidationError extends Error {}
  class ProjectCreationPersistenceError extends Error {}

  return {
    executeCreateProjectRpcMock: vi.fn(),
    ProjectCreationValidationErrorMock: ProjectCreationValidationError,
    ProjectCreationPersistenceErrorMock: ProjectCreationPersistenceError,
  };
});

vi.mock("@/lib/project-workflow/createProjectRpc", () => ({
  executeCreateProjectRpc: executeCreateProjectRpcMock,
  ProjectCreationValidationError: ProjectCreationValidationErrorMock,
  ProjectCreationPersistenceError: ProjectCreationPersistenceErrorMock,
}));

import { POST } from "./route";

const allowedInputKeys = [
  "idea",
  "businessName",
  "industry",
  "country",
  "city",
  "stage",
  "audience",
  "ageRange",
  "customerType",
  "goals",
  "budget",
  "timeline",
  "currency",
];

function jsonRequest(body: unknown) {
  return new Request("https://fikra.test/api/projects/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("projects create route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedUserMock.mockResolvedValue({ id: "user_test_1" });
    createProjectMock.mockResolvedValue({
      projectId: "proj_test_1",
      status: "queued",
      workflowRunId: "run_test_1",
    });
  });

  it("1: unauthenticated request returns 401 and calls neither createProject nor the RPC executor", async () => {
    requireAuthenticatedUserMock.mockRejectedValueOnce(new AuthenticationRequiredErrorMock());

    const res = await POST(jsonRequest({ idea: "A sufficiently detailed project idea." }));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe("Authentication required.");
    expect(createProjectMock).not.toHaveBeenCalled();
    expect(executeCreateProjectRpcMock).not.toHaveBeenCalled();
  });

  it("2: an authenticated valid request threads the parsed input and the RPC executor, and returns the existing response shape", async () => {
    const input = {
      idea: "A sufficiently detailed project idea for testing.",
      currency: "JOD",
      budget: "under_5000",
      timeline: "within_30_days",
    };

    const res = await POST(jsonRequest(input));
    const body = (await res.json()) as Record<string, unknown>;

    expect(requireAuthenticatedUserMock).toHaveBeenCalledTimes(1);
    expect(createProjectMock).toHaveBeenCalledTimes(1);

    const [receivedInput, receivedExecutor] = createProjectMock.mock.calls[0] as [Record<string, unknown>, { execute: unknown }];

    expect(receivedInput.idea).toBe(input.idea);
    for (const key of Object.keys(receivedInput)) {
      expect(allowedInputKeys).toContain(key);
    }
    expect(receivedInput).not.toHaveProperty("userId");
    expect(receivedInput).not.toHaveProperty("user_id");

    expect(receivedExecutor.execute).toBe(executeCreateProjectRpcMock);

    expect(res.status).toBe(200);
    expect(body).toEqual({ projectId: "proj_test_1", status: "queued" });
    expect("workflowRunId" in body).toBe(false);
    expect("organizationId" in body).toBe(false);
  });

  it("3: the existing short-idea validation remains HTTP 400", async () => {
    const res = await POST(jsonRequest({ idea: "short" }));

    expect(res.status).toBe(400);
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("4: ProjectCreationValidationError maps to HTTP 400 with a safe generic public error message", async () => {
    createProjectMock.mockRejectedValueOnce(new ProjectCreationValidationErrorMock("idea must be at least 10 characters."));

    const res = await POST(jsonRequest({
      idea: "A sufficiently detailed project idea.",
      currency: "JOD",
      budget: "under_5000",
      timeline: "within_30_days",
    }));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid project input.");
    expect(body.error).not.toMatch(/characters/i);
  });

  it("5a: ProjectCreationPersistenceError preserves the existing 500 response", async () => {
    createProjectMock.mockRejectedValueOnce(new ProjectCreationPersistenceErrorMock("db exploded"));

    const res = await POST(jsonRequest({
      idea: "A sufficiently detailed project idea.",
      currency: "JOD",
      budget: "under_5000",
      timeline: "within_30_days",
    }));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(500);
    expect(body.error).toBe("Could not create project.");
  });

  it("5b: an unexpected error preserves the existing 500 response", async () => {
    createProjectMock.mockRejectedValueOnce(new Error("boom"));

    const res = await POST(jsonRequest({
      idea: "A sufficiently detailed project idea.",
      currency: "JOD",
      budget: "under_5000",
      timeline: "within_30_days",
    }));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(500);
    expect(body.error).toBe("Could not create project.");
  });

  it("7: missing currency fails project submission with HTTP 400", async () => {
    const res = await POST(jsonRequest({ idea: "A sufficiently detailed project idea.", budget: "under_5000", timeline: "within_30_days" }));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("Currency is required.");
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("7b: missing budget fails project submission with HTTP 400, independently of currency/timeline", async () => {
    const res = await POST(jsonRequest({ idea: "A sufficiently detailed project idea.", currency: "JOD", timeline: "within_30_days" }));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("Budget is required.");
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("7c: missing timeline fails project submission with HTTP 400, independently of currency/budget", async () => {
    const res = await POST(jsonRequest({ idea: "A sufficiently detailed project idea.", currency: "JOD", budget: "under_5000" }));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("Launch timeline is required.");
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("8: an invalid currency code fails project submission with HTTP 400", async () => {
    const res = await POST(jsonRequest({
      idea: "A sufficiently detailed project idea.",
      currency: "Jordanian Dinar",
      budget: "under_5000",
      timeline: "within_30_days",
    }));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("Currency must be a 3-letter code, such as JOD, USD, or SAR.");
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("8b: a fabricated ISO-shaped currency code (real shape, not a real currency) fails project submission with HTTP 400", async () => {
    const res = await POST(jsonRequest({
      idea: "A sufficiently detailed project idea.",
      currency: "XYZ",
      budget: "under_5000",
      timeline: "within_30_days",
    }));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("Currency must be a 3-letter code, such as JOD, USD, or SAR.");
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("9: currency is normalized to uppercase before reaching createProject", async () => {
    await POST(jsonRequest({
      idea: "A sufficiently detailed project idea.",
      currency: "jod",
      budget: "under_5000",
      timeline: "within_30_days",
    }));

    const [receivedInput] = createProjectMock.mock.calls[0] as [Record<string, unknown>, { execute: unknown }];
    expect(receivedInput.currency).toBe("JOD");
  });

  it("10: an unrecognized budget id fails project submission with HTTP 400", async () => {
    const res = await POST(
      jsonRequest({ idea: "A sufficiently detailed project idea.", currency: "JOD", budget: "Under SAR 5,000" }),
    );
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("Please select a valid budget option.");
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("11: an unrecognized timeline id fails project submission with HTTP 400", async () => {
    const res = await POST(
      jsonRequest({
        idea: "A sufficiently detailed project idea.",
        currency: "JOD",
        budget: "under_5000",
        timeline: "Within 30 days",
      }),
    );
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("Please select a valid launch timeline option.");
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("12: canonical budget and timeline ids are accepted and passed through unchanged", async () => {
    await POST(
      jsonRequest({
        idea: "A sufficiently detailed project idea.",
        currency: "JOD",
        budget: "under_5000",
        timeline: "within_30_days",
      }),
    );

    const [receivedInput] = createProjectMock.mock.calls[0] as [Record<string, unknown>, { execute: unknown }];
    expect(receivedInput.budget).toBe("under_5000");
    expect(receivedInput.timeline).toBe("within_30_days");
  });

  it("6: the route source does not import or call createAdminClient", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const routePath = fileURLToPath(new URL("./route.ts", import.meta.url));
    const source = readFileSync(routePath, "utf8");

    expect(source).not.toMatch(/supabase\/admin/);
    expect(source).not.toMatch(/createAdminClient/);
  });
});
