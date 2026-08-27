import { beforeEach, describe, expect, it, vi } from "vitest";

const fixedIso = "2026-07-28T00:00:00.000Z";

const { requireAuthenticatedUserMock, AuthenticationRequiredErrorMock } = vi.hoisted(() => {
  class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication required.");
      this.name = "AuthenticationRequiredError";
    }
  }

  return {
    AuthenticationRequiredErrorMock: AuthenticationRequiredError,
    requireAuthenticatedUserMock: vi.fn(async () => ({
      id: "user_test_1",
    })),
  };
});

vi.mock("@/lib/auth/requireAuthenticatedUser", () => ({
  AuthenticationRequiredError: AuthenticationRequiredErrorMock,
  requireAuthenticatedUser: requireAuthenticatedUserMock,
}));

const { listProjectHistoryMock } = vi.hoisted(() => ({
  listProjectHistoryMock: vi.fn(async () => [
    {
      id: "proj_test_1",
      name: "Test Project",
      ideaExcerpt: "Idea excerpt",
      status: "completed",
      createdAt: fixedIso,
      updatedAt: fixedIso,
    },
  ]),
}));

vi.mock("@/lib/project-workflow/service", async () => {
  const persistenceSetup = await vi.importActual<typeof import("@/lib/persistence/setup")>("@/lib/persistence/setup");
  return {
    listProjectHistory: listProjectHistoryMock,
    PersistenceConfigurationError: persistenceSetup.PersistenceConfigurationError,
  };
});

import { GET } from "./route";
import { PersistenceConfigurationError } from "@/lib/persistence/setup";

describe("projects history route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedUserMock.mockResolvedValue({ id: "user_test_1" });
    listProjectHistoryMock.mockResolvedValue([
      {
        id: "proj_test_1",
        name: "Test Project",
        ideaExcerpt: "Idea excerpt",
        status: "completed",
        createdAt: fixedIso,
        updatedAt: fixedIso,
      },
    ]);
  });

  it("returns the typed items payload and threads the authenticated user's id into the service call", async () => {
    const res = await GET();
    const body = (await res.json()) as { items?: unknown };

    expect(res.status).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);
    expect((body.items as Array<{ id: string }>)[0]?.id).toBe("proj_test_1");
    expect(requireAuthenticatedUserMock).toHaveBeenCalledTimes(1);
    expect(listProjectHistoryMock).toHaveBeenCalledWith({ userId: "user_test_1" }, 50);
  });

  it("returns 401 and does not call the service when the caller is not authenticated", async () => {
    requireAuthenticatedUserMock.mockRejectedValueOnce(new AuthenticationRequiredErrorMock());

    const res = await GET();
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe("Authentication required.");
    expect(listProjectHistoryMock).not.toHaveBeenCalled();
  });

  it("a PersistenceConfigurationError from the service produces HTTP 503 with a persistence_unavailable code, not a generic 500", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listProjectHistoryMock.mockRejectedValueOnce(
      new PersistenceConfigurationError("Production persistence requires AI_PERSISTENCE_PROVIDER=supabase."),
    );

    const res = await GET();
    const body = (await res.json()) as { error?: string; code?: string };

    expect(res.status).toBe(503);
    expect(body.code).toBe("persistence_unavailable");
    expect(typeof body.error).toBe("string");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/persistence/i);

    consoleErrorSpy.mockRestore();
  });

  it("the 503 response does not leak the raw configuration error text", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listProjectHistoryMock.mockRejectedValueOnce(
      new PersistenceConfigurationError("Supabase persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Missing: SUPABASE_URL."),
    );

    const res = await GET();
    const body = (await res.json()) as { error?: string };

    expect(body.error).not.toMatch(/SUPABASE_URL/);

    consoleErrorSpy.mockRestore();
  });

  it("a generic unexpected error still produces the existing plain 500 (unaffected by the new classification)", async () => {
    listProjectHistoryMock.mockRejectedValueOnce(new Error("boom"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Could not load project history." });
  });
});
