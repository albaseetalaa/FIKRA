import { describe, expect, it } from "vitest";
import {
  RetryEngine,
  calculateRetryDelayMs,
  type RetryPolicy,
} from "../reliability";
import { WorkflowStateMachine } from "../workflow/stateMachine";

const basePolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 1000,
  backoffStrategy: "fixed",
  retryableErrorCodes: ["AGENT_EXECUTION_FAILED"],
  retryableErrorTypes: ["TimeoutError"],
};

describe("RetryEngine", () => {
  it("retryable error succeeds on a later attempt", async () => {
    let failuresRemaining = 2;
    const sleeps: number[] = [];
    const engine = new RetryEngine(basePolicy, async (delayMs) => {
      sleeps.push(delayMs);
    });

    let attempt = 1;
    let success = false;
    while (!success) {
      if (failuresRemaining > 0) {
        failuresRemaining -= 1;
        const decision = engine.decide({
          currentAttempt: attempt,
          error: new Error("timeout"),
          errorCode: "AGENT_EXECUTION_FAILED",
          retryableHint: true,
        });

        if (decision.action === "retry") {
          await engine.wait(decision.delayMs);
          attempt = decision.nextAttempt ?? attempt + 1;
          continue;
        }

        break;
      }

      success = true;
    }

    expect(success).toBe(true);
    expect(attempt).toBe(3);
    expect(sleeps).toEqual([100, 100]);
  });

  it("retryable error exhausts max attempts", () => {
    const engine = new RetryEngine(basePolicy, async () => {});

    const first = engine.decide({
      currentAttempt: 1,
      error: new Error("timeout"),
      errorCode: "AGENT_EXECUTION_FAILED",
      retryableHint: true,
    });
    expect(first.action).toBe("retry");

    const second = engine.decide({
      currentAttempt: 2,
      error: new Error("timeout"),
      errorCode: "AGENT_EXECUTION_FAILED",
      retryableHint: true,
    });
    expect(second.action).toBe("retry");

    const third = engine.decide({
      currentAttempt: 3,
      error: new Error("timeout"),
      errorCode: "AGENT_EXECUTION_FAILED",
      retryableHint: true,
    });
    expect(third.action).toBe("fail");
    expect(third.reason).toContain("maxAttempts=3");
  });

  it("fatal error fails immediately", () => {
    const engine = new RetryEngine(basePolicy, async () => {});
    const decision = engine.decide({
      currentAttempt: 1,
      error: new Error("something unexpected happened"),
      errorCode: "SCHEMA_VALIDATION_FAILED",
    });

    expect(decision.action).toBe("fail");
    expect(decision.classification).toBe("fatal");
  });

  it("returns wait_for_user for requires-user-input classification", () => {
    const engine = new RetryEngine(basePolicy, async () => {});
    const decision = engine.decide({
      currentAttempt: 1,
      error: new Error("requires user input: missing required project field"),
      errorCode: "MISSING_REQUIRED_FIELDS",
    });

    expect(decision.action).toBe("wait_for_user");
    expect(decision.classification).toBe("requires_user_input");
  });

  it("calculates fixed backoff", () => {
    const policy: RetryPolicy = { ...basePolicy, backoffStrategy: "fixed", baseDelayMs: 250, maxDelayMs: 1000 };
    expect(calculateRetryDelayMs(policy, 1)).toBe(250);
    expect(calculateRetryDelayMs(policy, 2)).toBe(250);
    expect(calculateRetryDelayMs(policy, 3)).toBe(250);
  });

  it("calculates exponential backoff", () => {
    const policy: RetryPolicy = { ...basePolicy, backoffStrategy: "exponential", baseDelayMs: 100, maxDelayMs: 1000 };
    expect(calculateRetryDelayMs(policy, 1)).toBe(100);
    expect(calculateRetryDelayMs(policy, 2)).toBe(200);
    expect(calculateRetryDelayMs(policy, 3)).toBe(400);
  });

  it("caps backoff at maxDelayMs", () => {
    const policy: RetryPolicy = { ...basePolicy, backoffStrategy: "exponential", baseDelayMs: 500, maxDelayMs: 900 };
    expect(calculateRetryDelayMs(policy, 1)).toBe(500);
    expect(calculateRetryDelayMs(policy, 2)).toBe(900);
    expect(calculateRetryDelayMs(policy, 3)).toBe(900);
  });

  it("defaults unknown error to fatal", () => {
    const engine = new RetryEngine(basePolicy, async () => {});
    const decision = engine.decide({
      currentAttempt: 1,
      error: { foo: "bar" },
      errorCode: null,
      errorType: null,
    });

    expect(decision.classification).toBe("fatal");
    expect(decision.action).toBe("fail");
  });

  it("prevents infinite retry loop via strict maxAttempts", () => {
    const engine = new RetryEngine(basePolicy, async () => {});

    let attempts = 0;
    while (attempts < 20) {
      attempts += 1;
      const decision = engine.decide({
        currentAttempt: attempts,
        error: new Error("timeout"),
        errorCode: "AGENT_EXECUTION_FAILED",
        retryableHint: true,
      });

      if (decision.action !== "retry") {
        expect(attempts).toBe(basePolicy.maxAttempts);
        break;
      }
    }
  });

  it("supports running -> retrying -> running transition and final failed state after exhaustion", () => {
    const workflow = new WorkflowStateMachine("planning", "wf-retry");
    workflow.transitionTo("running");

    const engine = new RetryEngine(basePolicy, async () => {});

    const d1 = engine.decide({
      currentAttempt: 1,
      error: new Error("timeout"),
      errorCode: "AGENT_EXECUTION_FAILED",
      retryableHint: true,
    });
    expect(d1.action).toBe("retry");
    workflow.transitionTo("retrying");
    workflow.transitionTo("running");

    const d2 = engine.decide({
      currentAttempt: 2,
      error: new Error("timeout"),
      errorCode: "AGENT_EXECUTION_FAILED",
      retryableHint: true,
    });
    expect(d2.action).toBe("retry");
    workflow.transitionTo("retrying");
    workflow.transitionTo("running");

    const d3 = engine.decide({
      currentAttempt: 3,
      error: new Error("timeout"),
      errorCode: "AGENT_EXECUTION_FAILED",
      retryableHint: true,
    });
    expect(d3.action).toBe("fail");
    workflow.transitionTo("failed");

    expect(workflow.status).toBe("failed");
  });
});
