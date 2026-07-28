import { z } from "zod";
import { resumeWorkflowInputSchema, userInputRequestSchema } from "../../ai/reliability";

export const resumeRequestBodySchema = resumeWorkflowInputSchema;

export const resumeResponseSchema = z.object({
  state: z.enum([
    "resumed_running",
    "resumed_completed",
    "paused_again",
    "validation_error",
    "stale_request",
    "invalid_state",
    "duplicate_request",
  ]),
  workflowRunId: z.string(),
  checkpointVersion: z.number().int().positive(),
  message: z.string(),
  nextRequest: userInputRequestSchema.optional(),
});

export type ResumeRequestBody = z.infer<typeof resumeRequestBodySchema>;
export type ResumeResponseBody = z.infer<typeof resumeResponseSchema>;
