export type ErrorClassification = "retryable" | "fatal" | "requires_user_input";

export interface ErrorClassificationResult {
  classification: ErrorClassification;
  reason: string;
  errorCode: string | null;
  errorType: string | null;
  message: string;
}

export interface ErrorClassificationContext {
  error: unknown;
  errorCode?: string | null;
  errorType?: string | null;
  retryableHint?: boolean;
  retryableErrorCodes: string[];
  retryableErrorTypes: string[];
}

function toMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Unknown error";
}

function detectErrorType(error: unknown, providedType?: string | null) {
  if (providedType) return providedType;
  if (error instanceof Error) return error.name;
  if (error && typeof error === "object" && "name" in error) {
    const maybeName = (error as { name?: unknown }).name;
    if (typeof maybeName === "string") return maybeName;
  }
  return null;
}

const requiresUserPatterns = [/requires user input/i, /missing required/i, /provide .*input/i, /human review/i];

export function classifyExecutionError(context: ErrorClassificationContext): ErrorClassificationResult {
  const message = toMessage(context.error);
  const errorType = detectErrorType(context.error, context.errorType ?? null);
  const errorCode = context.errorCode ?? null;

  if (requiresUserPatterns.some((pattern) => pattern.test(message))) {
    return {
      classification: "requires_user_input",
      reason: "Error indicates workflow requires additional user input.",
      errorCode,
      errorType,
      message,
    };
  }

  if (context.retryableHint === true) {
    return {
      classification: "retryable",
      reason: "Error was marked retryable by upstream component.",
      errorCode,
      errorType,
      message,
    };
  }

  if (errorCode && context.retryableErrorCodes.includes(errorCode)) {
    return {
      classification: "retryable",
      reason: `Error code '${errorCode}' is configured as retryable.`,
      errorCode,
      errorType,
      message,
    };
  }

  if (errorType && context.retryableErrorTypes.includes(errorType)) {
    return {
      classification: "retryable",
      reason: `Error type '${errorType}' is configured as retryable.`,
      errorCode,
      errorType,
      message,
    };
  }

  return {
    classification: "fatal",
    reason: "Error is not recognized as retryable; defaulting to fatal.",
    errorCode,
    errorType,
    message,
  };
}
