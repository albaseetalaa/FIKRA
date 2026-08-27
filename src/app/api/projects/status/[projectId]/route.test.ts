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

const successResult = {
  projectId: "proj_test_1",
  name: "Test Project",
  idea: "Test idea",
  status: "running",
  currentStep: "running",
  errorMessage: null,
  startedAt: "2026-08-01T00:00:00.000Z",
  completedAt: null,
  workflowStatus: "running",
  pausedTaskId: null,
  userInputRequest: null,
  capabilities: [],
  businessPlan: null,
  marketResearchReport: null,
  financialModel: null,
  projectScore: null,
};

const { getProjectStatusMock } = vi.hoisted(() => ({
  getProjectStatusMock: vi.fn(async (_ctx: unknown, _projectId: unknown) => null as unknown),
}));

vi.mock("@/lib/project-workflow/service", async () => {
  const persistenceSetup = await vi.importActual<typeof import("@/lib/persistence/setup")>("@/lib/persistence/setup");
  return {
    getProjectStatus: getProjectStatusMock,
    PersistenceConfigurationError: persistenceSetup.PersistenceConfigurationError,
  };
});

import { GET } from "./route";
import { PersistenceConfigurationError } from "@/lib/persistence/setup";

function makeRouteParams(projectId: string) {
  return { params: Promise.resolve({ projectId }) };
}

describe("project status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedUserMock.mockResolvedValue({ id: "user_test_1" });
    getProjectStatusMock.mockResolvedValue(successResult);
  });

  it("1: captures the authenticated user and calls getProjectStatus with { userId } and projectId", async () => {
    const res = await GET(
      new Request("https://fikra.test/api/projects/status/proj_test_1"),
      makeRouteParams("proj_test_1"),
    );

    expect(requireAuthenticatedUserMock).toHaveBeenCalledTimes(1);
    expect(getProjectStatusMock).toHaveBeenCalledTimes(1);
    expect(getProjectStatusMock).toHaveBeenCalledWith({ userId: "user_test_1" }, "proj_test_1");
    expect(res.status).toBe(200);
  });

  it("2: an authorized project preserves the existing successful response shape", async () => {
    const res = await GET(
      new Request("https://fikra.test/api/projects/status/proj_test_1"),
      makeRouteParams("proj_test_1"),
    );
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body).toEqual(successResult);
    expect("organizationId" in body).toBe(false);
    expect("createdBy" in body).toBe(false);
  });

  it("3: a null service result preserves 404 Project not found", async () => {
    getProjectStatusMock.mockResolvedValueOnce(null);

    const res = await GET(
      new Request("https://fikra.test/api/projects/status/proj_missing"),
      makeRouteParams("proj_missing"),
    );
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Project not found." });
  });

  it("4: the same 404 response is used for a cross-creator project as for a nonexistent one", async () => {
    getProjectStatusMock.mockResolvedValueOnce(null);
    const nonexistentRes = await GET(
      new Request("https://fikra.test/api/projects/status/proj_missing"),
      makeRouteParams("proj_missing"),
    );
    const nonexistentBody = await nonexistentRes.json();

    getProjectStatusMock.mockResolvedValueOnce(null);
    const crossCreatorRes = await GET(
      new Request("https://fikra.test/api/projects/status/proj_other_creator"),
      makeRouteParams("proj_other_creator"),
    );
    const crossCreatorBody = await crossCreatorRes.json();

    expect(nonexistentRes.status).toBe(crossCreatorRes.status);
    expect(nonexistentBody).toEqual(crossCreatorBody);
    expect(nonexistentRes.status).toBe(404);
  });

  it("5: unauthenticated request returns 401", async () => {
    requireAuthenticatedUserMock.mockRejectedValueOnce(new AuthenticationRequiredErrorMock());

    const res = await GET(
      new Request("https://fikra.test/api/projects/status/proj_test_1"),
      makeRouteParams("proj_test_1"),
    );
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Authentication required." });
    expect(getProjectStatusMock).not.toHaveBeenCalled();
  });

  it("6: a generic unexpected error preserves the existing 500 response", async () => {
    getProjectStatusMock.mockRejectedValueOnce(new Error("boom"));

    const res = await GET(
      new Request("https://fikra.test/api/projects/status/proj_test_1"),
      makeRouteParams("proj_test_1"),
    );
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Could not fetch project status." });
  });

  it("7: a PersistenceConfigurationError from the service produces HTTP 503 with a persistence_unavailable code, not a generic 500", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getProjectStatusMock.mockRejectedValueOnce(
      new PersistenceConfigurationError("Production persistence requires AI_PERSISTENCE_PROVIDER=supabase."),
    );

    const res = await GET(
      new Request("https://fikra.test/api/projects/status/proj_test_1"),
      makeRouteParams("proj_test_1"),
    );
    const body = (await res.json()) as { error?: string; code?: string };

    expect(res.status).toBe(503);
    expect(body.code).toBe("persistence_unavailable");
    expect(typeof body.error).toBe("string");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/persistence/i);

    consoleErrorSpy.mockRestore();
  });

  it("8: the 503 response does not leak the raw configuration error text", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getProjectStatusMock.mockRejectedValueOnce(
      new PersistenceConfigurationError("Supabase persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Missing: SUPABASE_URL."),
    );

    const res = await GET(
      new Request("https://fikra.test/api/projects/status/proj_test_1"),
      makeRouteParams("proj_test_1"),
    );
    const body = (await res.json()) as { error?: string };

    expect(body.error).not.toMatch(/SUPABASE_URL/);

    consoleErrorSpy.mockRestore();
  });
});
