import { z } from "zod";
import type { TaskStatus, WorkflowStatus } from "../workflow/stateMachine";

export type PauseReason = "requires_user_input";

export type UserInputFieldType = "text" | "textarea" | "number" | "boolean" | "select";

export interface UserInputFieldOption {
  value: string;
  label: string;
}

export interface UserInputFieldConstraint {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface UserInputFieldDefinition {
  key: string;
  label: string;
  type: UserInputFieldType;
  required: boolean;
  options?: UserInputFieldOption[];
  constraints?: UserInputFieldConstraint;
}

export interface UserInputRequest {
  requestId: string;
  workflowRunId: string;
  taskId: string;
  agentId: string;
  question: string;
  context: string;
  requiredFields: UserInputFieldDefinition[];
  createdAt: string;
}

export interface WorkflowCheckpoint {
  workflowRunId: string;
  projectId: string;
  currentTaskId: string;
  workflowStatus: WorkflowStatus;
  taskStatus: TaskStatus;
  completedTaskIds: string[];
  pendingTaskIds: string[];
  dependencyState: Record<string, string[]>;
  attemptCounters: Record<string, number>;
  userInputRequest: UserInputRequest;
  executionContext: Record<string, unknown>;
  checkpointVersion: number;
  createdAt: string;
  updatedAt: string;
  requestConsumedAt: string | null;
}

export interface ResumeWorkflowInput {
  workflowRunId: string;
  requestId: string;
  checkpointVersion: number;
  values: Record<string, unknown>;
}

export type ResumeState =
  | "resumed_running"
  | "resumed_completed"
  | "paused_again"
  | "validation_error"
  | "stale_request"
  | "invalid_state"
  | "duplicate_request";

export interface ResumeResult {
  state: ResumeState;
  workflowRunId: string;
  checkpointVersion: number;
  message: string;
  nextRequest?: UserInputRequest;
}

const userInputFieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const userInputFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "boolean", "select"]),
  required: z.boolean(),
  options: z.array(userInputFieldOptionSchema).optional(),
  constraints: z
    .object({
      minLength: z.number().int().nonnegative().optional(),
      maxLength: z.number().int().positive().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
});

export const userInputRequestSchema = z.object({
  requestId: z.string().min(1),
  workflowRunId: z.string().min(1),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  question: z.string().min(1),
  context: z.string(),
  requiredFields: z.array(userInputFieldSchema).min(1),
  createdAt: z.string().min(1),
});

export const resumeWorkflowInputSchema = z.object({
  requestId: z.string().min(1),
  checkpointVersion: z.number().int().positive(),
  values: z.record(z.unknown()),
});

export function validateUserInputValues(
  requiredFields: UserInputFieldDefinition[],
  values: Record<string, unknown>,
): { ok: true; normalized: Record<string, unknown> } | { ok: false; message: string } {
  const normalized: Record<string, unknown> = {};

  for (const field of requiredFields) {
    const raw = values[field.key];

    if (field.required && (raw === undefined || raw === null || raw === "")) {
      return { ok: false, message: `Missing required field '${field.key}'.` };
    }

    if (raw === undefined || raw === null) {
      continue;
    }

    if ((field.type === "text" || field.type === "textarea") && typeof raw !== "string") {
      return { ok: false, message: `Field '${field.key}' must be a string.` };
    }

    if (field.type === "number") {
      const parsed = typeof raw === "number" ? raw : Number(raw);
      if (Number.isNaN(parsed)) {
        return { ok: false, message: `Field '${field.key}' must be a valid number.` };
      }
      if (field.constraints?.min !== undefined && parsed < field.constraints.min) {
        return { ok: false, message: `Field '${field.key}' must be >= ${field.constraints.min}.` };
      }
      if (field.constraints?.max !== undefined && parsed > field.constraints.max) {
        return { ok: false, message: `Field '${field.key}' must be <= ${field.constraints.max}.` };
      }
      normalized[field.key] = parsed;
      continue;
    }

    if (field.type === "boolean") {
      if (typeof raw === "boolean") {
        normalized[field.key] = raw;
        continue;
      }
      if (raw === "true") {
        normalized[field.key] = true;
        continue;
      }
      if (raw === "false") {
        normalized[field.key] = false;
        continue;
      }
      return { ok: false, message: `Field '${field.key}' must be boolean.` };
    }

    if (field.type === "select") {
      if (typeof raw !== "string") {
        return { ok: false, message: `Field '${field.key}' must be a string option value.` };
      }
      const options = field.options ?? [];
      if (!options.some((option) => option.value === raw)) {
        return { ok: false, message: `Field '${field.key}' has invalid option '${raw}'.` };
      }
      normalized[field.key] = raw;
      continue;
    }

    if (typeof raw === "string") {
      if (field.constraints?.minLength !== undefined && raw.length < field.constraints.minLength) {
        return { ok: false, message: `Field '${field.key}' must be at least ${field.constraints.minLength} characters.` };
      }
      if (field.constraints?.maxLength !== undefined && raw.length > field.constraints.maxLength) {
        return { ok: false, message: `Field '${field.key}' must be at most ${field.constraints.maxLength} characters.` };
      }
    }

    normalized[field.key] = raw;
  }

  return { ok: true, normalized };
}
