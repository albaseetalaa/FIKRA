import { describe, expect, it, vi } from "vitest";

import { createProjectStartRetrier, createProjectSubmitter } from "./submitProject";
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

  it("never includes currencyInputMode — it is wizard/draft UI state only, never project business data", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/projects/create") return jsonResponse(200, { projectId: "proj_test_1" });
      return jsonResponse(200, { status: "running" });
    });

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);
    const dataWithCurrencyMode: WizardData = {
      ...validData,
      currency: "JOD",
      currencyInputMode: "suggested",
    };

    await submit(dataWithCurrencyMode);

    const createBody = JSON.parse((fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(createBody.currency).toBe("JOD");
    expect(createBody).not.toHaveProperty("currencyInputMode");
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

  it("includes the created projectId when the start stage fails, so the caller can offer retry", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/projects/create") return jsonResponse(200, { projectId: "proj_test_1" });
      return jsonResponse(500, { error: "Could not start execution." });
    });

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);
    const result = await submit(validData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("start");
      expect(result.projectId).toBe("proj_test_1");
    }
  });

  it("maps a 503 persistence_unavailable start response to kind 'unavailable' with the created projectId", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/projects/create") return jsonResponse(200, { projectId: "proj_test_1" });
      return jsonResponse(503, {
        error: "Your project is saved, but the AI workflow could not start because this environment isn't fully configured yet. Please try again shortly.",
        code: "persistence_unavailable",
      });
    });

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);
    const result = await submit(validData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("unavailable");
      expect(result.stage).toBe("start");
      expect(result.projectId).toBe("proj_test_1");
      expect(result.message).toMatch(/saved/i);
    }
  });
});

describe("createProjectStartRetrier", () => {
  it("calls only /api/projects/start with the given projectId, never /api/projects/create", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: "running" }));

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const result = await retryStart("proj_test_1");

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    const [url, init] = calls[0]!;
    expect(url).toBe("/api/projects/start");
    expect(JSON.parse(init.body as string)).toEqual({ projectId: "proj_test_1" });

    for (const call of calls) {
      expect(call[0]).not.toBe("/api/projects/create");
    }
  });

  it("collapses concurrent retry calls into a single in-flight request (double-click safe)", async () => {
    let startCalls = 0;
    const fetchImpl = vi.fn(async () => {
      startCalls += 1;
      return jsonResponse(200, { status: "running" });
    });

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const [first, second] = await Promise.all([retryStart("proj_test_1"), retryStart("proj_test_1")]);

    expect(startCalls).toBe(1);
    expect(first).toEqual(second);
  });

  it("keeps concurrent retries for different projectIds independent (no cross-project result mixing)", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const { projectId } = JSON.parse(init?.body as string) as { projectId: string };
      if (projectId === "proj_a") return jsonResponse(200, { status: "running" });
      return jsonResponse(500, { error: "Could not start execution." });
    });

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const [resultA, resultB] = await Promise.all([retryStart("proj_a"), retryStart("proj_b")]);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(resultA).toEqual({ ok: true });
    expect(resultB.ok).toBe(false);
    if (!resultB.ok) {
      expect(resultB.kind).toBe("server");
    }
  });

  it("does not let an earlier call's cleanup clobber a later, still-pending call's in-flight tracking", async () => {
    let resolveA!: (value: Response) => void;
    let resolveB!: (value: Response) => void;
    const pendingA = new Promise<Response>((resolve) => {
      resolveA = resolve;
    });
    const pendingB = new Promise<Response>((resolve) => {
      resolveB = resolve;
    });

    let bCallCount = 0;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const { projectId } = JSON.parse(init?.body as string) as { projectId: string };
      if (projectId === "proj_a") return pendingA;
      bCallCount += 1;
      return pendingB;
    });

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);

    // Start proj_a and proj_b concurrently — both requests are in flight,
    // proj_b having overwritten the shared "current in-flight" tracking
    // (per the round-1 fix, since they are different projectIds).
    const firstA = retryStart("proj_a");
    const firstB = retryStart("proj_b");

    // proj_a settles first, while proj_b is still pending. Awaiting firstA
    // guarantees its .finally cleanup has already run by the time we
    // continue, since .finally()'s returned promise resolves only after
    // the callback completes.
    resolveA(jsonResponse(200, { status: "running" }));
    await firstA;

    // A double-click style retry for the still-pending proj_b arrives now.
    // If proj_a's cleanup incorrectly cleared the shared in-flight state
    // (the round-1 bug), this would start a second, duplicate fetch for
    // proj_b instead of collapsing into the still-pending one.
    const secondB = retryStart("proj_b");

    resolveB(jsonResponse(200, { status: "running" }));
    const [resultB1, resultB2] = await Promise.all([firstB, secondB]);

    expect(bCallCount).toBe(1);
    expect(resultB1).toEqual(resultB2);
  });

  it("allows a new retry after the previous one has settled", async () => {
    let startCalls = 0;
    const fetchImpl = vi.fn(async () => {
      startCalls += 1;
      return jsonResponse(200, { status: "running" });
    });

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    await retryStart("proj_test_1");
    await retryStart("proj_test_1");

    expect(startCalls).toBe(2);
  });

  it("maps a 503 persistence_unavailable response to kind 'unavailable'", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(503, { error: "Not ready yet.", code: "persistence_unavailable" }),
    );

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const result = await retryStart("proj_test_1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("unavailable");
    }
  });

  it("maps a 401 response to kind 'auth' without leaking response details", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, { error: "Authentication required.", internalTraceId: "trace-xyz" }),
    );

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const result = await retryStart("proj_test_1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("auth");
      expect(result.message).not.toMatch(/trace-xyz/);
    }
  });

  it("maps a network failure to kind 'network'", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const result = await retryStart("proj_test_1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("network");
    }
  });

  it("maps any other non-ok status to kind 'server'", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, { error: "Could not start execution." }));

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const result = await retryStart("proj_test_1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("server");
    }
  });
});
