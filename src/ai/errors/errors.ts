export type ErrorCode =
  | "SCHEMA_VALIDATION_FAILED"
  | "MISSING_REQUIRED_FIELDS"
  | "INVALID_FIELD_TYPE"
  | "MALFORMED_JSON"
  | "AGENT_EXECUTION_FAILED"
  | "PIPELINE_DEPENDENCY_FAILED"
  | "UNKNOWN_OUTPUT_MODEL"
  | "OPENAI_AUTHENTICATION_ERROR"
  | "OPENAI_RATE_LIMIT"
  | "OPENAI_TIMEOUT"
  | "OPENAI_NETWORK_ERROR"
  | "OPENAI_INVALID_REQUEST"
  | "OPENAI_MODEL_UNAVAILABLE"
  | "OPENAI_SERVER_ERROR"
  | "OPENAI_EMPTY_RESPONSE"
  | "OPENAI_MALFORMED_OUTPUT"
  | "OPENAI_UNKNOWN_ERROR";

export interface AiError {
  code: ErrorCode;
  message: string;
  agentId?: string;
  pipelineId?: string;
  taskId?: string;
  fieldPath?: string[];
  timestamp: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export function makeError(params: Omit<AiError, "timestamp">): AiError {
  return { ...params, timestamp: new Date().toISOString() };
}
