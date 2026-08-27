import { schemas } from "../schemas/schemas";
import { OutputModelName } from "../types/outputs";
import { z } from "zod";
import type { ProjectContext } from "../context";
import type { BusinessPlan, FinancialModel, MarketResearchReport } from "../types/outputs";
import { validateBusinessPlanSemantics, validateFinancialModelSemantics, validateMarketResearchSemantics } from "./semanticValidators";

export type ValidationResult<T = unknown> =
  | { success: true; value: T }
  | { success: false; errors: z.ZodIssue[] };

export interface ValidationOptions {
  projectContext?: ProjectContext;
}

function toSemanticIssues(path: string, messages: string[]) {
  return messages.map((message) => ({
    code: z.ZodIssueCode.custom,
    path: [path],
    message,
  } as z.ZodIssue));
}

/**
 * Structural-only validation: resolves the model's schema and runs
 * schema.safeParse against it. No BusinessPlan/FinancialModel/
 * MarketResearchReport semantic rules and no stale-milestone/business-logic
 * checks run here — those are validateModel()'s job. This is the function
 * the SDK's structural validation stage must call, so a structurally valid
 * but semantically invalid output is classified as a semantic failure
 * (lifecycle.ts) instead of being misreported as "did not match expected
 * schema".
 */
export function validateModelStructure<T = unknown>(modelName: OutputModelName, raw: unknown): ValidationResult<T> {
  const schema = schemas[modelName];
  if (!schema) {
    return { success: false, errors: [{ code: z.ZodIssueCode.custom, path: [], message: `Unknown model: ${modelName}` } as z.ZodIssue] };
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return { success: true, value: parsed.data as T };
  }
  return { success: false, errors: parsed.error.issues };
}

export function validateModel<T = unknown>(modelName: OutputModelName, raw: unknown, options: ValidationOptions = {}): ValidationResult<T> {
  const structural = validateModelStructure<T>(modelName, raw);
  if (!structural.success) return structural;

  if (modelName === "BusinessPlan") {
    const plan = structural.value as {
      projectCreatedAt?: string;
      generatedAt?: string;
      milestones?: Array<{
        targetDate?: string;
        dueDate?: string;
        dateSource?: "user_provided" | "calculated_from_timeline" | "model_assumption";
      }>;
    };

    const baselineDate = new Date(
      plan.projectCreatedAt
        ?? options.projectContext?.projectCreatedAt
        ?? plan.generatedAt
        ?? "",
    );
    if (!Number.isNaN(baselineDate.getTime())) {
      for (const milestone of plan.milestones ?? []) {
        const rawDate = milestone.targetDate ?? milestone.dueDate;
        if (!rawDate) continue;
        const targetDate = new Date(rawDate);
        if (Number.isNaN(targetDate.getTime())) continue;
        const isHistoricalUserProvided = milestone.dateSource === "user_provided";
        if (!isHistoricalUserProvided && targetDate.getTime() < baselineDate.getTime()) {
          return {
            success: false,
            errors: [
              {
                code: z.ZodIssueCode.custom,
                path: ["milestones"],
                message: `Stale milestone date detected: ${rawDate}`,
              } as z.ZodIssue,
            ],
          };
        }
      }
    }

    const semanticIssues = validateBusinessPlanSemantics(structural.value as BusinessPlan, options.projectContext);
    if (semanticIssues.length > 0) {
      return {
        success: false,
        errors: toSemanticIssues("BusinessPlan", semanticIssues),
      };
    }
  }

  if (modelName === "FinancialModel") {
    const semanticIssues = validateFinancialModelSemantics(structural.value as FinancialModel, options.projectContext);
    if (semanticIssues.length > 0) {
      return {
        success: false,
        errors: toSemanticIssues("FinancialModel", semanticIssues),
      };
    }
  }

  if (modelName === "MarketResearchReport") {
    const semanticIssues = validateMarketResearchSemantics(structural.value as MarketResearchReport);
    if (semanticIssues.length > 0) {
      return {
        success: false,
        errors: toSemanticIssues("MarketResearchReport", semanticIssues),
      };
    }
  }

  return { success: true, value: structural.value as T };
}

export default validateModel;
