import { describe, expect, it, vi } from "vitest";

import { createProjectSubmitter } from "./submitProject";
import { initialWizardData, type WizardData } from "./types";

const validData: WizardData = {
  ...initialWizardData,
  idea: "A healthy breakfast restaurant idea with egg sandwiches.",
  industry: "Restaurant & Food",
  country: "Jordan",
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("createProjectSubmitter", () => {
  it("calls the existing protected create then start endpoints with the documented contract", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/projects/create") {
        return jsonResponse(200, { projectId: "proj_test_1", status: "queued" });
      }
      if (url === "/api/projects/start") {
        return jsonResponse(200, { status: "running" });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);
    const result = await submit(validData);

    expect(result).toEqual({ ok: true, projectId: "proj_test_1" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [createCall, startCall] = fetchImpl.mock.calls;
    expect(createCall?.[0]).toBe("/api/projects/create");
    expect((createCall?.[1] as RequestInit).method).toBe("POST");

    const createBody = JSON.parse((createCall?.[1] as RequestInit).body as string);
    expect(createBody.idea).toBe(validData.idea);

    expect(startCall?.[0]).toBe("/api/projects/start");
    const startBody = JSON.parse((startCall?.[1] as RequestInit).body as string);
    expect(startBody).toEqual({ projectId: "proj_test_1" });
  });

  it("never includes client-supplied tenant/user identity fields in the request payload", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/projects/create") return jsonResponse(200, { projectId: "proj_test_1" });
      return jsonResponse(200, { status: "running" });
    });

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);

    const tamperedData = {
      ...validData,
      userId: "attacker-controlled-user",
      organizationId: "attacker-controlled-org",
      ownerId: "attacker-controlled-owner",
    } as unknown as WizardData;

    await submit(tamperedData);

    const createBody = JSON.parse((fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(createBody).not.toHaveProperty("userId");
    expect(createBody).not.toHaveProperty("user_id");
    expect(createBody).not.toHaveProperty("organizationId");
    expect(createBody).not.toHaveProperty("ownerId");
  });

  it("collapses concurrent calls into a single in-flight submission (duplicate submit prevention)", async () => {
    let createCalls = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/projects/create") {
        createCalls += 1;
        return jsonResponse(200, { projectId: "proj_test_1" });
      }
      return jsonResponse(200, { status: "running" });
    });

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);

    const [first, second] = await Promise.all([submit(validData), submit(validData)]);

    expect(createCalls).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(first).toEqual(second);
  });

  it("allows a new submission after the previous one has settled", async () => {
    let createCalls = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/projects/create") {
        createCalls += 1;
        return jsonResponse(200, { projectId: "proj_test_1" });
      }
      return jsonResponse(200, { status: "running" });
    });

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);

    await submit(validData);
    await submit(validData);

    expect(createCalls).toBe(2);
  });

  it("maps an unauthenticated (401) response to a generic auth error without leaking response details", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, { error: "Authentication required.", internalTraceId: "trace-abc-123" }),
    );

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);
    const result = await submit(validData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("auth");
      expect(result.message).toBe("Your session has expired. Please log in again.");
      expect(result.message).not.toMatch(/trace-abc-123/);
    }
  });

  it("maps invalid form data (400) to a validation error", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, { error: "Please provide a more detailed project idea." }),
    );

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);
    const result = await submit(validData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("validation");
      expect(result.stage).toBe("create");
    }
  });

  it("maps a network failure during project creation to a network error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);
    const result = await submit(validData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("network");
      expect(result.stage).toBe("create");
    }
  });

  it("maps a project creation server failure (500) distinctly from a start failure", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, { error: "Could not create project." }));

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);
    const result = await submit(validData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("server");
      expect(result.stage).toBe("create");
    }
  });

  it("maps a workflow start failure (500 on the second call) with stage 'start'", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/projects/create") return jsonResponse(200, { projectId: "proj_test_1" });
      return jsonResponse(500, { error: "Could not start execution." });
    });

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);
    const result = await submit(validData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("server");
      expect(result.stage).toBe("start");
    }
  });
});
