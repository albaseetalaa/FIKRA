import { schemas } from "../schemas/schemas";
import { OutputModelName } from "../types/outputs";
import { z } from "zod";

export type ValidationResult<T = unknown> =
  | { success: true; value: T }
  | { success: false; errors: z.ZodIssue[] };

export function validateModel<T = unknown>(modelName: OutputModelName, raw: unknown): ValidationResult<T> {
  const schema = schemas[modelName];
  if (!schema) {
    return { success: false, errors: [{ code: z.ZodIssueCode.custom, path: [], message: `Unknown model: ${modelName}` } as z.ZodIssue] };
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success) return { success: true, value: parsed.data as T };
  return { success: false, errors: parsed.error.issues };
}

export default validateModel;
