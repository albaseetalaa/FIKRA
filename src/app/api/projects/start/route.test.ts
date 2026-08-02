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

const { authorizeProjectStartMock, startBusinessStrategistExecutionMock, ProjectStartAuthorizationErrorMock } = vi.hoisted(() => {
  class ProjectStartAuthorizationError extends Error {
    constructor() {
      super("Project start authorization failed.");
      this.name = "ProjectStartAuthorizationError";
    }
  }

  return {
    ProjectStartAuthorizationErrorMock: ProjectStartAuthorizationError,
    authorizeProjectStartMock: vi.fn(async (_ctx: unknown, _projectId: unknown) => ({
      projectId: "proj_test_1",
      organizationId: "org_test_1",
    }) as unknown),
    startBusinessStrategistExecutionMock: vi.fn(async (_handoff: unknown) => undefined),
  };
});

vi.mock("@/lib/project-workflow/service", () => ({
  authorizeProjectStart: authorizeProjectStartMock,
  startBusinessStrategistExecution: startBusinessStrategistExecutionMock,
  ProjectStartAuthorizationError: ProjectStartAuthorizationErrorMock,
}));

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("https://fikra.test/api/projects/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("projects start route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedUserMock.mockResolvedValue({ id: "user_test_1" });
    authorizeProjectStartMock.mockResolvedValue({ projectId: "proj_test_1", organizationId: "org_test_1" });
    startBusinessStrategistExecutionMock.mockResolvedValue(undefined);
  });

  it("1: captures the authenticated user", async () => {
    await POST(jsonRequest({ projectId: "proj_test_1" }));

    expect(requireAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it("2: calls authorizeProjectStart with { userId } and the parsed projectId", async () => {
    await POST(jsonRequest({ projectId: "proj_test_1" }));

    expect(authorizeProjectStartMock).toHaveBeenCalledWith({ userId: "user_test_1" }, "proj_test_1");
  });

  it("3: calls startBusinessStrategistExecution with exactly the returned handoff", async () => {
    const handoff = { projectId: "proj_test_1", organizationId: "org_test_1" };
    authorizeProjectStartMock.mockResolvedValueOnce(handoff);

    await POST(jsonRequest({ projectId: "proj_test_1" }));

    expect(startBusinessStrategistExecutionMock).toHaveBeenCalledTimes(1);
    expect(startBusinessStrategistExecutionMock).toHaveBeenCalledWith(handoff);
  });

  it("4: the route does not reconstruct or add fields to the handoff", async () => {
    const handoff = { projectId: "proj_test_1", organizationId: "org_test_1" };
    authorizeProjectStartMock.mockResolvedValueOnce(handoff);

    await POST(jsonRequest({ projectId: "proj_test_1" }));

    const receivedHandoff = startBusinessStrategistExecutionMock.mock.calls[0]?.[0];
    expect(receivedHandoff).toBe(handoff);
    expect(Object.keys(receivedHandoff as object).sort()).toEqual(["organizationId", "projectId"]);
  });

  it("5: successful response remains exactly HTTP 200 { status: 'running' }", async () => {
    const res = await POST(jsonRequest({ projectId: "proj_test_1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "running" });
  });

  it("6: missing/blank projectId remains HTTP 400", async () => {
    const res = await POST(jsonRequest({ projectId: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "projectId is required." });
    expect(authorizeProjectStartMock).not.toHaveBeenCalled();
    expect(startBusinessStrategistExecutionMock).not.toHaveBeenCalled();
  });

  it("7: authorizeProjectStart returning null produces HTTP 404 Project not found", async () => {
    authorizeProjectStartMock.mockResolvedValueOnce(null);

    const res = await POST(jsonRequest({ projectId: "proj_missing" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Project not found." });
    expect(startBusinessStrategistExecutionMock).not.toHaveBeenCalled();
  });

  it("8: ProjectStartAuthorizationError from the system re-check produces the same HTTP 404", async () => {
    startBusinessStrategistExecutionMock.mockRejectedValueOnce(new ProjectStartAuthorizationErrorMock());

    const res = await POST(jsonRequest({ projectId: "proj_test_1" }));
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Project not found." });
  });

  it("9: unauthenticated request returns 401 and calls neither service function", async () => {
    requireAuthenticatedUserMock.mockRejectedValueOnce(new AuthenticationRequiredErrorMock());

    const res = await POST(jsonRequest({ projectId: "proj_test_1" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Authentication required." });
    expect(authorizeProjectStartMock).not.toHaveBeenCalled();
    expect(startBusinessStrategistExecutionMock).not.toHaveBeenCalled();
  });

  it("10: a generic unexpected error preserves the existing 500 response", async () => {
    startBusinessStrategistExecutionMock.mockRejectedValueOnce(new Error("boom"));

    const res = await POST(jsonRequest({ projectId: "proj_test_1" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Could not start execution." });
  });

  it("11: no userId, organizationId, or createdBy appears in any public response", async () => {
    const res = await POST(jsonRequest({ projectId: "proj_test_1" }));
    const body = (await res.json()) as Record<string, unknown>;

    expect("userId" in body).toBe(false);
    expect("organizationId" in body).toBe(false);
    expect("createdBy" in body).toBe(false);
  });
});
