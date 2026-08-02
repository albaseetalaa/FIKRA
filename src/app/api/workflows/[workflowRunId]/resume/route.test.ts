import { beforeEach, describe, expect, it, vi } from "vitest";

// `@/...` alias imports do not resolve under this project's zero-config
// vitest setup unless the target module is mocked (only `vi.mock`'s
// specifier interception works; real filesystem alias resolution does
// not). Every module route.ts imports via the `@/...` alias must
// therefore be mocked here even where, as with the contract schemas
// below, the mock re-declares the real, unmodified validation logic so
// this RED batch still exercises genuine schema behavior.
vi.mock("@/lib/project-workflow/resumeContract", async () => {
  const { z: zod } = await import("zod");

  const userInputFieldOptionSchemaMock = zod.object({
    value: zod.string(),
    label: zod.string(),
  });
  const userInputFieldDefinitionSchemaMock = zod.object({
    key: zod.string(),
    label: zod.string(),
    type: zod.enum(["text", "number", "select", "boolean"]),
    required: zod.boolean(),
    options: zod.array(userInputFieldOptionSchemaMock).optional(),
  });
  const userInputRequestSchemaMock = zod.object({
    requestId: zod.string(),
    workflowRunId: zod.string(),
    taskId: zod.string(),
    agentId: zod.string(),
    question: zod.string(),
    context: zod.string(),
    requiredFields: zod.array(userInputFieldDefinitionSchemaMock),
    createdAt: zod.string(),
  });
  const resumeRequestBodySchemaMock = zod.object({
    requestId: zod.string().min(1),
    checkpointVersion: zod.number().int().positive(),
    values: zod.record(zod.unknown()),
  });
  const resumeResponseSchemaMock = zod.object({
    state: zod.enum([
      "resumed_running",
      "resumed_completed",
      "paused_again",
      "validation_error",
      "stale_request",
      "invalid_state",
      "duplicate_request",
    ]),
    workflowRunId: zod.string(),
    checkpointVersion: zod.number().int().positive(),
    message: zod.string(),
    nextRequest: userInputRequestSchemaMock.optional(),
  });

  return {
    resumeRequestBodySchema: resumeRequestBodySchemaMock,
    resumeResponseSchema: resumeResponseSchemaMock,
  };
});

const {
  ResumeRequestAlreadyConsumedError,
  ResumeRequestMismatchError,
  ResumeValidationError,
  StaleCheckpointError,
  WorkflowNotPausedError,
} = vi.hoisted(() => {
  class ResumeValidationErrorMock extends Error {
    constructor(message = "Invalid resume input.") {
      super(message);
      this.name = "ResumeValidationError";
    }
  }
  class ResumeRequestMismatchErrorMock extends Error {
    constructor(message = "The resume request does not match the pending checkpoint.") {
      super(message);
      this.name = "ResumeRequestMismatchError";
    }
  }
  class ResumeRequestAlreadyConsumedErrorMock extends Error {
    constructor(message = "This resume request has already been consumed.") {
      super(message);
      this.name = "ResumeRequestAlreadyConsumedError";
    }
  }
  class StaleCheckpointErrorMock extends Error {
    constructor(message = "The checkpoint has changed since this request was issued.") {
      super(message);
      this.name = "StaleCheckpointError";
    }
  }
  class WorkflowNotPausedErrorMock extends Error {
    constructor(message = "Workflow is not waiting for input.") {
      super(message);
      this.name = "WorkflowNotPausedError";
    }
  }

  return {
    ResumeValidationError: ResumeValidationErrorMock,
    ResumeRequestMismatchError: ResumeRequestMismatchErrorMock,
    ResumeRequestAlreadyConsumedError: ResumeRequestAlreadyConsumedErrorMock,
    StaleCheckpointError: StaleCheckpointErrorMock,
    WorkflowNotPausedError: WorkflowNotPausedErrorMock,
  };
});

vi.mock("@/ai/reliability", () => ({
  ResumeRequestAlreadyConsumedError,
  ResumeRequestMismatchError,
  ResumeValidationError,
  StaleCheckpointError,
  WorkflowNotPausedError,
}));

const { requireAuthenticatedUserMock, AuthenticationRequiredErrorMock } = vi.hoisted(() => {
  class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication required.");
      this.name = "AuthenticationRequiredError";
    }
  }

  return {
    AuthenticationRequiredErrorMock: AuthenticationRequiredError,
    requireAuthenticatedUserMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/requireAuthenticatedUser", () => ({
  AuthenticationRequiredError: AuthenticationRequiredErrorMock,
  requireAuthenticatedUser: requireAuthenticatedUserMock,
}));

const { authorizeWorkflowResumeMock, resumeWorkflowMock, WorkflowResumeAuthorizationErrorMock } = vi.hoisted(() => {
  class WorkflowResumeAuthorizationError extends Error {
    constructor() {
      super("Workflow resume authorization failed.");
      this.name = "WorkflowResumeAuthorizationError";
    }
  }

  return {
    WorkflowResumeAuthorizationErrorMock: WorkflowResumeAuthorizationError,
    authorizeWorkflowResumeMock: vi.fn(),
    resumeWorkflowMock: vi.fn(),
  };
});

vi.mock("@/lib/project-workflow/service", () => ({
  authorizeWorkflowResume: authorizeWorkflowResumeMock,
  resumeWorkflow: resumeWorkflowMock,
  WorkflowResumeAuthorizationError: WorkflowResumeAuthorizationErrorMock,
}));

import { POST } from "./route";

const USER_ID = "user-resume-route-a";
const WORKFLOW_RUN_ID = "run-resume-route-a";
const PROJECT_ID = "proj-resume-route-a";
const ORGANIZATION_ID = "org-resume-route-a";

const authenticatedUser = { id: USER_ID };

const validHandoff = {
  workflowRunId: WORKFLOW_RUN_ID,
  projectId: PROJECT_ID,
  organizationId: ORGANIZATION_ID,
};

const validBody = {
  requestId: "request-resume-route-a",
  checkpointVersion: 3,
  values: { answer: "approved" },
};

const validResumeResult = {
  state: "resumed_completed" as const,
  workflowRunId: WORKFLOW_RUN_ID,
  checkpointVersion: 4,
  message: "Workflow resumed and completed.",
};

function jsonRequest(body: unknown) {
  return new Request(`https://fikra.test/api/workflows/${WORKFLOW_RUN_ID}/resume`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function ctxFor(workflowRunId: string) {
  return { params: Promise.resolve({ workflowRunId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthenticatedUserMock.mockResolvedValue(authenticatedUser);
  authorizeWorkflowResumeMock.mockResolvedValue(validHandoff);
  resumeWorkflowMock.mockResolvedValue(validResumeResult);
});

describe("workflows resume route", () => {
  describe("C1: authentication occurs first", () => {
    it("1: requireAuthenticatedUser is called exactly once", async () => {
      await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));

      expect(requireAuthenticatedUserMock).toHaveBeenCalledTimes(1);
    });

    it("2: authentication failure stops the request before body parsing and before both service calls", async () => {
      requireAuthenticatedUserMock.mockRejectedValueOnce(new AuthenticationRequiredErrorMock());
      const req = jsonRequest(validBody);
      const jsonSpy = vi.spyOn(req, "json");

      await POST(req, ctxFor(WORKFLOW_RUN_ID));

      expect(jsonSpy).not.toHaveBeenCalled();
      expect(authorizeWorkflowResumeMock).not.toHaveBeenCalled();
      expect(resumeWorkflowMock).not.toHaveBeenCalled();
    });
  });

  describe("C2: unauthenticated response contract", () => {
    it("3: returns HTTP 401 { error: 'Authentication required.' }", async () => {
      requireAuthenticatedUserMock.mockRejectedValueOnce(new AuthenticationRequiredErrorMock());

      const res = await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body).toEqual({ error: "Authentication required." });
    });
  });

  describe("C3: request-side authorization call", () => {
    it("4: calls authorizeWorkflowResume with { userId } and the unchanged params workflowRunId", async () => {
      await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));

      expect(authorizeWorkflowResumeMock).toHaveBeenCalledWith({ userId: USER_ID }, WORKFLOW_RUN_ID);
    });
  });

  describe("C4: request-side null result", () => {
    it("5: returns HTTP 404 { error: 'Workflow not found.' } and never calls resumeWorkflow", async () => {
      authorizeWorkflowResumeMock.mockResolvedValueOnce(null);

      const res = await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body).toEqual({ error: "Workflow not found." });
      expect(resumeWorkflowMock).not.toHaveBeenCalled();
    });
  });

  describe("C5: verified execution call", () => {
    it("6: calls resumeWorkflow with the exact handoff reference and exactly {requestId, checkpointVersion, values}", async () => {
      await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));

      expect(resumeWorkflowMock).toHaveBeenCalledTimes(1);
      const receivedHandoff = resumeWorkflowMock.mock.calls[0]?.[0];
      const receivedInput = resumeWorkflowMock.mock.calls[0]?.[1];

      expect(receivedHandoff).toBe(validHandoff);
      expect(receivedInput).toEqual({
        requestId: validBody.requestId,
        checkpointVersion: validBody.checkpointVersion,
        values: validBody.values,
      });
      expect(Object.keys((receivedInput ?? {}) as object).sort()).toEqual(["checkpointVersion", "requestId", "values"]);
      expect(receivedInput && "workflowRunId" in receivedInput).toBe(false);
      expect(receivedInput && "userId" in receivedInput).toBe(false);
      expect(receivedInput && "createdBy" in receivedInput).toBe(false);
      expect(receivedInput && "projectId" in receivedInput).toBe(false);
      expect(receivedInput && "organizationId" in receivedInput).toBe(false);
    });
  });

  describe("C6: success response", () => {
    it("7: HTTP 200 with body equal to the resumeWorkflow result, no extra tenant identifiers", async () => {
      const res = await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(body).toEqual(validResumeResult);
      expect("userId" in body).toBe(false);
      expect("organizationId" in body).toBe(false);
      expect("createdBy" in body).toBe(false);
      expect("projectId" in body).toBe(false);
    });
  });

  describe("C7: system-side authorization failure", () => {
    it("8: WorkflowResumeAuthorizationError maps to the same non-disclosing 404", async () => {
      resumeWorkflowMock.mockRejectedValueOnce(new WorkflowResumeAuthorizationErrorMock());

      const res = await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(404);
      expect(body).toEqual({ error: "Workflow not found." });
      expect("workflowRunId" in body).toBe(false);
      expect("projectId" in body).toBe(false);
      expect("organizationId" in body).toBe(false);
      expect("userId" in body).toBe(false);
    });
  });

  describe("C8: ResumeValidationError", () => {
    it("9: preserves the route's existing status/state/message contract", async () => {
      const domainError = new ResumeValidationError("Missing required field: answer.");
      resumeWorkflowMock.mockRejectedValueOnce(domainError);

      const res = await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body).toEqual({ state: "validation_error", error: domainError.message });
    });
  });

  describe("C9: ResumeRequestMismatchError", () => {
    it("10: preserves the route's existing status/state/message contract", async () => {
      const domainError = new ResumeRequestMismatchError();
      resumeWorkflowMock.mockRejectedValueOnce(domainError);

      const res = await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body).toEqual({ state: "validation_error", error: domainError.message });
    });
  });

  describe("C10: ResumeRequestAlreadyConsumedError", () => {
    it("11: preserves the route's existing status/state/message contract", async () => {
      const domainError = new ResumeRequestAlreadyConsumedError();
      resumeWorkflowMock.mockRejectedValueOnce(domainError);

      const res = await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body).toEqual({ state: "duplicate_request", error: domainError.message });
    });
  });

  describe("C11: StaleCheckpointError", () => {
    it("12: preserves the route's existing status/state/message contract", async () => {
      const domainError = new StaleCheckpointError();
      resumeWorkflowMock.mockRejectedValueOnce(domainError);

      const res = await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body).toEqual({ state: "stale_request", error: domainError.message });
    });
  });

  describe("C12: WorkflowNotPausedError", () => {
    it("13: preserves the route's existing status/state/message contract", async () => {
      const domainError = new WorkflowNotPausedError();
      resumeWorkflowMock.mockRejectedValueOnce(domainError);

      const res = await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body).toEqual({ state: "invalid_state", error: domainError.message });
    });
  });

  describe("C13: unexpected error", () => {
    it("14: preserves HTTP 500 { error: 'Could not resume workflow.' }", async () => {
      resumeWorkflowMock.mockRejectedValueOnce(new Error("boom"));

      const res = await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toEqual({ error: "Could not resume workflow." });
    });
  });

  describe("C14: body validation", () => {
    it("15: malformed JSON currently falls through to the generic 500 response", async () => {
      const req = new Request(`https://fikra.test/api/workflows/${WORKFLOW_RUN_ID}/resume`, {
        method: "POST",
        body: "{not valid json",
      });

      const res = await POST(req, ctxFor(WORKFLOW_RUN_ID));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toEqual({ error: "Could not resume workflow." });
      expect(authorizeWorkflowResumeMock).not.toHaveBeenCalled();
      expect(resumeWorkflowMock).not.toHaveBeenCalled();
    });

    it("16: a schema-invalid body currently falls through to the generic 500 response", async () => {
      const res = await POST(jsonRequest({ requestId: "x" }), ctxFor(WORKFLOW_RUN_ID));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toEqual({ error: "Could not resume workflow." });
      expect(authorizeWorkflowResumeMock).not.toHaveBeenCalled();
      expect(resumeWorkflowMock).not.toHaveBeenCalled();
    });
  });

  describe("C15: call ordering", () => {
    it("17: requireAuthenticatedUser precedes request.json precedes authorizeWorkflowResume precedes resumeWorkflow", async () => {
      const req = jsonRequest(validBody);
      const jsonSpy = vi.spyOn(req, "json");

      await POST(req, ctxFor(WORKFLOW_RUN_ID));

      const authOrder = requireAuthenticatedUserMock.mock.invocationCallOrder[0];
      const jsonOrder = jsonSpy.mock.invocationCallOrder[0];
      const authorizeOrder = authorizeWorkflowResumeMock.mock.invocationCallOrder[0];
      const resumeOrder = resumeWorkflowMock.mock.invocationCallOrder[0];

      expect(authOrder).toBeDefined();
      expect(jsonOrder).toBeDefined();
      expect(authorizeOrder).toBeDefined();
      expect(resumeOrder).toBeDefined();
      expect(authOrder!).toBeLessThan(jsonOrder!);
      expect(jsonOrder!).toBeLessThan(authorizeOrder!);
      expect(authorizeOrder!).toBeLessThan(resumeOrder!);
    });
  });

  describe("D: security assertions", () => {
    it("18: a request-side authorization rejection means resumeWorkflow is never called", async () => {
      authorizeWorkflowResumeMock.mockResolvedValueOnce(null);

      await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));

      expect(resumeWorkflowMock).not.toHaveBeenCalled();
    });

    it("19: WorkflowResumeAuthorizationError never surfaces as a 400/409 domain response", async () => {
      resumeWorkflowMock.mockRejectedValueOnce(new WorkflowResumeAuthorizationErrorMock());

      const res = await POST(jsonRequest(validBody), ctxFor(WORKFLOW_RUN_ID));

      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(409);
      expect(res.status).toBe(404);
    });

    it("20: an unauthenticated request never reads the body and calls no application service", async () => {
      requireAuthenticatedUserMock.mockRejectedValueOnce(new AuthenticationRequiredErrorMock());
      const req = jsonRequest(validBody);
      const jsonSpy = vi.spyOn(req, "json");

      await POST(req, ctxFor(WORKFLOW_RUN_ID));

      expect(jsonSpy).not.toHaveBeenCalled();
      expect(authorizeWorkflowResumeMock).not.toHaveBeenCalled();
      expect(resumeWorkflowMock).not.toHaveBeenCalled();
    });
  });
});
