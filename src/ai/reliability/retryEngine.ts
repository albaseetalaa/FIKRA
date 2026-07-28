import {
  classifyExecutionError,
  type ErrorClassification,
  type ErrorClassificationResult,
} from "./errorClassification";

export type BackoffStrategy = "fixed" | "exponential";

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffStrategy: BackoffStrategy;
  retryableErrorCodes: string[];
  retryableErrorTypes: string[];
}

export interface RetryDecisionInput {
  currentAttempt: number;
  error: unknown;
  errorCode?: string | null;
  errorType?: string | null;
  retryableHint?: boolean;
}

export type RetryDecisionAction = "retry" | "fail" | "wait_for_user";

export interface RetryDecision {
  action: RetryDecisionAction;
  reason: string;
  currentAttempt: number;
  nextAttempt: number | null;
  delayMs: number;
  classification: ErrorClassification;
  classificationDetails: ErrorClassificationResult;
}

export type SleepFunction = (delayMs: number) => Promise<void>;

const defaultSleep: SleepFunction = async (delayMs: number) => {
  if (delayMs <= 0) return;
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

export const defaultRetryPolicy: RetryPolicy = {
  // maxAttempts includes the initial attempt.
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 2000,
  backoffStrategy: "exponential",
  retryableErrorCodes: ["AGENT_EXECUTION_FAILED", "OPENAI_TIMEOUT", "OPENAI_RATE_LIMIT", "OPENAI_NETWORK_ERROR", "OPENAI_SERVER_ERROR"],
  retryableErrorTypes: ["OpenAIProviderError", "TimeoutError", "NetworkError"],
};

export function calculateRetryDelayMs(policy: RetryPolicy, currentAttempt: number) {
  if (policy.backoffStrategy === "fixed") {
    return Math.min(policy.baseDelayMs, policy.maxDelayMs);
  }

  const exponential = policy.baseDelayMs * Math.pow(2, Math.max(0, currentAttempt - 1));
  return Math.min(exponential, policy.maxDelayMs);
}

export class RetryEngine {
  private readonly policy: RetryPolicy;
  private readonly sleepFn: SleepFunction;

  constructor(policy: RetryPolicy = defaultRetryPolicy, sleepFn: SleepFunction = defaultSleep) {
    this.policy = policy;
    this.sleepFn = sleepFn;
  }

  getPolicy() {
    return this.policy;
  }

  decide(input: RetryDecisionInput): RetryDecision {
    const classification = classifyExecutionError({
      error: input.error,
      errorCode: input.errorCode,
      errorType: input.errorType,
      retryableHint: input.retryableHint,
      retryableErrorCodes: this.policy.retryableErrorCodes,
      retryableErrorTypes: this.policy.retryableErrorTypes,
    });

    if (classification.classification === "requires_user_input") {
      return {
        action: "wait_for_user",
        reason: classification.reason,
        currentAttempt: input.currentAttempt,
        nextAttempt: null,
        delayMs: 0,
        classification: classification.classification,
        classificationDetails: classification,
      };
    }

    if (classification.classification !== "retryable") {
      return {
        action: "fail",
        reason: classification.reason,
        currentAttempt: input.currentAttempt,
        nextAttempt: null,
        delayMs: 0,
        classification: classification.classification,
        classificationDetails: classification,
      };
    }

    if (input.currentAttempt >= this.policy.maxAttempts) {
      return {
        action: "fail",
        reason: `Retry attempts exhausted (maxAttempts=${this.policy.maxAttempts}, includes initial attempt).`,
        currentAttempt: input.currentAttempt,
        nextAttempt: null,
        delayMs: 0,
        classification: classification.classification,
        classificationDetails: classification,
      };
    }

    const delayMs = calculateRetryDelayMs(this.policy, input.currentAttempt);
    return {
      action: "retry",
      reason: classification.reason,
      currentAttempt: input.currentAttempt,
      nextAttempt: input.currentAttempt + 1,
      delayMs,
      classification: classification.classification,
      classificationDetails: classification,
    };
  }

  async wait(delayMs: number) {
    await this.sleepFn(delayMs);
  }
}

export default RetryEngine;
