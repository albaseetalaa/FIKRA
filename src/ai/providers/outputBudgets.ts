import type { OutputModelName } from "../types/outputs";

export type OutputBudgetConfig = {
  base: number;
  max: number;
};

const OUTPUT_BUDGET_DEFAULTS: Record<Extract<OutputModelName, "BusinessPlan" | "MarketResearchReport" | "FinancialModel">, OutputBudgetConfig> = {
  BusinessPlan: { base: 2200, max: 3200 },
  MarketResearchReport: { base: 1800, max: 2800 },
  FinancialModel: { base: 3600, max: 5200 },
};

function parsePositiveInt(raw: string | undefined) {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function readBudget(model: keyof typeof OUTPUT_BUDGET_DEFAULTS, kind: "base" | "max"): number {
  const defaults = OUTPUT_BUDGET_DEFAULTS[model];
  const envKey = kind === "base" ? `AI_OUTPUT_TOKENS_${model.toUpperCase()}` : `AI_OUTPUT_TOKENS_${model.toUpperCase()}_MAX`;
  const fromEnv = parsePositiveInt(process.env[envKey]);
  if (fromEnv == null) return defaults[kind];
  if (kind === "base") {
    return Math.min(fromEnv, readBudget(model, "max"));
  }
  return Math.max(fromEnv, defaults.base);
}

export function getOutputBudget(model: Extract<OutputModelName, "BusinessPlan" | "MarketResearchReport" | "FinancialModel">): OutputBudgetConfig {
  const base = readBudget(model, "base");
  const max = readBudget(model, "max");
  return {
    base: Math.min(base, max),
    max,
  };
}

export function getOutputBudgetByOutputModel(outputModel: OutputModelName | null | undefined): OutputBudgetConfig | null {
  if (!outputModel) return null;
  if (outputModel === "BusinessPlan" || outputModel === "MarketResearchReport" || outputModel === "FinancialModel") {
    return getOutputBudget(outputModel);
  }
  return null;
}
