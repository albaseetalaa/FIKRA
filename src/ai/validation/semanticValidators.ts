import { getVerticalTemplate } from "../context";
import type { ProjectContext, BusinessVertical, RevenueModel } from "../context";
import type { BusinessPlan, FinancialModel, MarketResearchReport, MonetaryValue, FinancialLineItem } from "../types/outputs";

const SEMANTIC_TOLERANCE = 1;

type VerticalRule = {
  requiredSignals: string[];
  forbiddenSignals: string[];
};

const verticalRules: Record<BusinessVertical, VerticalRule> = {
  restaurant_food_service: {
    requiredSignals: [
      "average_order_value",
      "daily_transactions",
      "operating_days_per_month",
      "food_cost",
      "packaging",
      "payroll",
      "rent",
      "channel_mix",
      "break_even_revenue",
      "break_even_daily_orders",
    ],
    forbiddenSignals: [
      "mrr",
      "arr",
      "churn",
      "subscription_tier",
      "starter",
      "professional",
      "business",
      "enterprise",
    ],
  },
  saas_software: {
    requiredSignals: ["mrr", "arr", "churn", "cac", "ltv"],
    forbiddenSignals: ["dine_in", "food_cost", "packaging", "drive_thru"],
  },
  ecommerce_retail: {
    requiredSignals: ["average_order_value", "conversion_rate", "inventory", "fulfillment", "returns", "advertising"],
    forbiddenSignals: ["mrr", "arr", "dine_in", "drive_thru"],
  },
  professional_services: {
    requiredSignals: ["billable_rate", "utilization", "project_value", "payroll"],
    forbiddenSignals: ["mrr", "arr", "food_cost", "inventory_turnover"],
  },
  marketplace: {
    requiredSignals: ["gmv", "take_rate", "buyer", "seller", "liquidity"],
    forbiddenSignals: ["dine_in", "food_cost", "starter", "enterprise"],
  },
  subscription_service: {
    requiredSignals: ["subscriber", "churn", "retention"],
    forbiddenSignals: ["dine_in", "drive_thru", "food_cost"],
  },
  physical_retail: {
    requiredSignals: ["store_traffic", "conversion_rate", "average_ticket_size"],
    forbiddenSignals: ["mrr", "arr", "churn"],
  },
  manufacturing: {
    requiredSignals: ["unit_output", "capacity_utilization"],
    forbiddenSignals: ["starter", "professional", "enterprise"],
  },
  real_estate: {
    requiredSignals: ["occupancy", "yield"],
    forbiddenSignals: ["mrr", "arr", "food_cost"],
  },
  logistics_delivery: {
    requiredSignals: ["deliveries_per_day", "average_fee", "fleet_utilization"],
    forbiddenSignals: ["starter", "professional", "enterprise"],
  },
  education_training: {
    requiredSignals: ["student_enrollment", "course_price", "completion_rate"],
    forbiddenSignals: ["dine_in", "food_cost"],
  },
  healthcare_wellness: {
    requiredSignals: ["appointments", "capacity_utilization"],
    forbiddenSignals: ["starter", "professional", "enterprise"],
  },
  generic_other: {
    requiredSignals: ["demand", "pricing", "conversion"],
    forbiddenSignals: ["starter", "professional", "business", "enterprise", "mrr", "arr", "churn"],
  },
  unknown: {
    requiredSignals: ["requires_user_input"],
    forbiddenSignals: ["starter", "professional", "business", "enterprise", "mrr", "arr", "churn"],
  },
};

function normalizeToken(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "_");
}

function canonicalizeSignal(token: string): string[] {
  const normalized = normalizeToken(token);
  const derived = new Set<string>([normalized]);

  if (normalized.includes("ingredient") || normalized.includes("food_cost") || normalized.includes("cogs")) {
    derived.add("food_cost");
  }

  if (normalized.includes("packag")) {
    derived.add("packaging");
  }

  return Array.from(derived);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function addIfMissing(issues: string[], condition: boolean, message: string) {
  if (!condition) issues.push(message);
}

function collectFinancialSignals(model: FinancialModel) {
  const signals = new Set<string>();

  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    for (const token of canonicalizeSignal(value)) {
      signals.add(token);
    }
  };

  model.revenueDrivers.forEach(push);
  model.costCategories.forEach(push);
  model.financialKPIs.forEach(push);
  model.revenueChannels.forEach(push);
  model.pricingRecommendation.forEach((tier) => push(tier.tier));
  if (typeof model.breakEvenAnalysis.breakEvenDailyOrders === "number") {
    signals.add("break_even_daily_orders");
  }
  if (typeof model.breakEvenAnalysis.requiredMonthlyRevenue?.amount === "number") {
    signals.add("break_even_revenue");
  }

  return signals;
}

function validateMonetaryValue(money: MonetaryValue | undefined, path: string, issues: string[]) {
  if (!money) {
    issues.push(`${path} is required.`);
    return;
  }

  if (!hasText(money.currency)) {
    issues.push(`${path} must include currency.`);
  }
  if (!hasText(money.period)) {
    issues.push(`${path} must include period.`);
  }
  if (!Array.isArray(money.assumptions) || money.assumptions.length === 0) {
    issues.push(`${path} must include assumptions.`);
  }
  if (typeof money.confidence !== "number" || money.confidence < 0 || money.confidence > 1) {
    issues.push(`${path} must include confidence between 0 and 1.`);
  }

  if (money.sourceType === "model_assumption" && money.confidence > 0.9) {
    issues.push(`${path} has unsupported precision: model assumptions cannot exceed confidence 0.9.`);
  }
}

function validateLineItemsFormula(lineItems: FinancialLineItem[], label: string, issues: string[]) {
  for (const lineItem of lineItems) {
    if (!hasText(lineItem.formula)) {
      issues.push(`${label}.${lineItem.id} must include a formula.`);
      continue;
    }

    const keys = (lineItem.inputValues ?? [])
      .map((entry) => entry.name)
      .filter((key) => hasText(key));
    if (keys.length === 0) {
      issues.push(`${label}.${lineItem.id} must include input values.`);
      continue;
    }

    const missingKeys = keys.filter((key) => !lineItem.formula.includes(key));
    if (missingKeys.length > 0) {
      issues.push(`${label}.${lineItem.id} formula does not reference inputs: ${missingKeys.join(", ")}`);
    }
  }
}

function validateScenarioCoherence(model: FinancialModel, issues: string[]) {
  for (const scenario of model.financialForecast) {
    validateMonetaryValue(scenario.monthlyRevenue, `financialForecast.${scenario.scenario}.monthlyRevenue`, issues);
    validateMonetaryValue(scenario.monthlyExpenses, `financialForecast.${scenario.scenario}.monthlyExpenses`, issues);
    validateMonetaryValue(scenario.grossProfit, `financialForecast.${scenario.scenario}.grossProfit`, issues);
    validateMonetaryValue(scenario.netProfit, `financialForecast.${scenario.scenario}.netProfit`, issues);

    const revenue = scenario.monthlyRevenue.amount;
    const expenses = scenario.monthlyExpenses.amount;
    const net = scenario.netProfit.amount;

    if (Math.abs((revenue - expenses) - net) > SEMANTIC_TOLERANCE) {
      issues.push(`financialForecast.${scenario.scenario} is incoherent: netProfit must equal monthlyRevenue - monthlyExpenses within tolerance ${SEMANTIC_TOLERANCE}.`);
    }

    if (scenario.grossProfit.amount - revenue > SEMANTIC_TOLERANCE) {
      issues.push(`financialForecast.${scenario.scenario} is incoherent: grossProfit cannot exceed monthlyRevenue.`);
    }

    if (!Array.isArray(scenario.assumptions) || scenario.assumptions.length === 0) {
      issues.push(`financialForecast.${scenario.scenario} must include assumptions.`);
    }

    if (typeof scenario.confidence !== "number" || scenario.confidence < 0 || scenario.confidence > 1) {
      issues.push(`financialForecast.${scenario.scenario} must include confidence between 0 and 1.`);
    }
  }
}

export function validateFinancialModelSemantics(
  model: FinancialModel,
  projectContext?: ProjectContext,
): string[] {
  const issues: string[] = [];
  const expectedVertical = projectContext?.businessVertical;
  const rule = verticalRules[model.verticalId as BusinessVertical] ?? verticalRules.generic_other;

  if (expectedVertical && model.verticalId !== expectedVertical) {
    issues.push(`FinancialModel verticalId '${model.verticalId}' does not match ProjectContext vertical '${expectedVertical}'.`);
  }

  if (projectContext && model.revenueModelType !== projectContext.revenueModelType) {
    issues.push(`FinancialModel revenueModelType '${model.revenueModelType}' does not match ProjectContext revenueModelType '${projectContext.revenueModelType}'.`);
  }

  validateLineItemsFormula(model.startupCosts, "startupCosts", issues);
  validateLineItemsFormula(model.operatingCosts, "operatingCosts", issues);

  for (const item of model.startupCosts) {
    validateMonetaryValue(item.value, `startupCosts.${item.id}.value`, issues);
  }

  for (const item of model.operatingCosts) {
    validateMonetaryValue(item.value, `operatingCosts.${item.id}.value`, issues);
  }

  for (const tier of model.pricingRecommendation) {
    if (!hasText(tier.reasoning)) {
      issues.push(`pricingRecommendation.${tier.tier} must include reasoning.`);
    }
    validateMonetaryValue(tier.recommendedPrice, `pricingRecommendation.${tier.tier}.recommendedPrice`, issues);
  }

  validateMonetaryValue(model.breakEvenAnalysis.requiredMonthlyRevenue, "breakEvenAnalysis.requiredMonthlyRevenue", issues);
  if (!hasText(model.breakEvenAnalysis.formula)) {
    issues.push("breakEvenAnalysis must include formula.");
  }
  if (typeof model.breakEvenAnalysis.breakEvenDailyOrders !== "number" || model.breakEvenAnalysis.breakEvenDailyOrders <= 0) {
    issues.push("breakEvenAnalysis.breakEvenDailyOrders must be a positive number.");
  }

  validateScenarioCoherence(model, issues);

  if (!Array.isArray(model.assumptions) || model.assumptions.length === 0) {
    issues.push("FinancialModel must include assumptions.");
  }
  if (typeof model.confidenceLevel !== "number" || model.confidenceLevel < 0 || model.confidenceLevel > 1) {
    issues.push("FinancialModel must include confidenceLevel between 0 and 1.");
  }

  const signals = collectFinancialSignals(model);

  const missingRequired = rule.requiredSignals.filter((signal) => !signals.has(signal));
  if (missingRequired.length > 0) {
    issues.push(`FinancialModel is missing required signals for ${model.verticalId}: ${missingRequired.join(", ")}`);
  }

  const forbiddenPresent = rule.forbiddenSignals.filter((signal) => signals.has(signal));
  if (forbiddenPresent.length > 0) {
    issues.push(`FinancialModel contains forbidden signals for ${model.verticalId}: ${forbiddenPresent.join(", ")}`);
  }

  return issues;
}

const genericObjectivePatterns = [
  /\bgrow the business\b/i,
  /\bimprove awareness\b/i,
  /\bacquire more customers\b/i,
];

function isObjectiveStageCompatible(timeHorizon: string, stage: ProjectContext["businessStage"]) {
  const normalized = timeHorizon.toLowerCase();
  if (stage === "idea" || stage === "planning") {
    return /week|month|quarter|year/.test(normalized);
  }
  return normalized.length > 0;
}

function getContextPrimaryRevenueModel(projectContext?: ProjectContext): RevenueModel | null {
  if (!projectContext) return null;
  return projectContext.primaryRevenueModel ?? projectContext.revenueModelType ?? null;
}

function getContextSalesChannels(projectContext?: ProjectContext): string[] {
  if (!projectContext) return [];
  if (Array.isArray(projectContext.salesChannels) && projectContext.salesChannels.length > 0) {
    return projectContext.salesChannels;
  }
  return projectContext.revenueChannels ?? [];
}

export function validateBusinessPlanSemantics(
  plan: BusinessPlan,
  projectContext?: ProjectContext,
): string[] {
  const issues: string[] = [];

  const planPrimaryRevenueModel = plan.primaryRevenueModel;
  const planSecondaryRevenueModels = Array.isArray(plan.secondaryRevenueModels) ? plan.secondaryRevenueModels : [];
  const planSalesChannels = Array.isArray(plan.salesChannels) ? plan.salesChannels : [];
  const planRevenueComponents = Array.isArray(plan.revenueComponents) ? plan.revenueComponents : [];

  const verticalTemplate = getVerticalTemplate(plan.businessVertical as BusinessVertical);
  const expectedPrimaryModels = verticalTemplate.applicableRevenueModels;
  const expectedSecondaryModels = verticalTemplate.allowedSecondaryRevenueModels ?? [];
  const expectedSalesChannels = verticalTemplate.allowedSalesChannels ?? [];
  const expectedRevenueComponents = verticalTemplate.allowedRevenueComponents ?? [];

  if (!Array.isArray(plan.objectives) || plan.objectives.length === 0) {
    issues.push("BusinessPlan must include at least one objective.");
  }

  for (const objective of plan.objectives) {
    const statement = objective.statement.trim();
    const metric = objective.metric.trim();
    const targetValue = objective.targetValue.trim();
    const timeHorizon = objective.timeHorizon.trim();

    addIfMissing(issues, statement.length > 0, `Objective ${objective.id} must include statement.`);
    addIfMissing(issues, metric.length > 0, `Objective ${objective.id} must include metric.`);
    addIfMissing(issues, targetValue.length > 0, `Objective ${objective.id} must include target value or qualitative criterion.`);
    addIfMissing(issues, timeHorizon.length > 0, `Objective ${objective.id} must include time horizon.`);

    if (genericObjectivePatterns.some((pattern) => pattern.test(statement))) {
      issues.push(`Objective ${objective.id} is too generic and must be measurable.`);
    }

    if (projectContext && !isObjectiveStageCompatible(timeHorizon, projectContext.businessStage)) {
      issues.push(`Objective ${objective.id} time horizon '${timeHorizon}' is not compatible with stage '${projectContext.businessStage}'.`);
    }
  }

  const milestoneDates = plan.milestones
    .map((milestone) => ({ id: milestone.id, date: new Date(milestone.targetDate).getTime() }))
    .filter((entry) => !Number.isNaN(entry.date));

  for (let index = 1; index < milestoneDates.length; index += 1) {
    if (milestoneDates[index - 1]!.date > milestoneDates[index]!.date) {
      issues.push("BusinessPlan milestones must be ordered by targetDate.");
      break;
    }
  }

  if (!expectedPrimaryModels.includes(planPrimaryRevenueModel)) {
    issues.push(
      `BusinessPlan primary revenue model incompatible with vertical: vertical='${plan.businessVertical}', expected one of [${expectedPrimaryModels.join(", ")}], received='${planPrimaryRevenueModel}'.`,
    );
  }

  const unsupportedSecondary = planSecondaryRevenueModels.filter((model) => !expectedSecondaryModels.includes(model));
  if (unsupportedSecondary.length > 0) {
    issues.push(
      `BusinessPlan secondary revenue models are not permitted for vertical '${plan.businessVertical}': expected subset of [${expectedSecondaryModels.join(", ")}], received unsupported [${unsupportedSecondary.join(", ")}].`,
    );
  }

  const unsupportedChannels = planSalesChannels.filter(
    (channel) => !expectedSalesChannels.includes(channel as (typeof expectedSalesChannels)[number]),
  );
  if (unsupportedChannels.length > 0) {
    issues.push(
      `BusinessPlan sales channels are unsupported for vertical '${plan.businessVertical}': expected subset of [${expectedSalesChannels.join(", ")}], received unsupported [${unsupportedChannels.join(", ")}].`,
    );
  }

  const unsupportedComponents = planRevenueComponents.filter(
    (component) => !expectedRevenueComponents.includes(component as (typeof expectedRevenueComponents)[number]),
  );
  if (unsupportedComponents.length > 0) {
    issues.push(
      `BusinessPlan revenue components are not permitted for vertical '${plan.businessVertical}': expected subset of [${expectedRevenueComponents.join(", ")}], received unsupported [${unsupportedComponents.join(", ")}].`,
    );
  }

  const contextPrimaryRevenueModel = getContextPrimaryRevenueModel(projectContext);
  if (contextPrimaryRevenueModel && planPrimaryRevenueModel !== contextPrimaryRevenueModel) {
    issues.push(
      `BusinessPlan primaryRevenueModel '${planPrimaryRevenueModel}' conflicts with normalized ProjectContext primaryRevenueModel '${contextPrimaryRevenueModel}'.`,
    );
  }

  if (projectContext && plan.businessVertical !== projectContext.businessVertical) {
    issues.push(`BusinessPlan businessVertical '${plan.businessVertical}' must match ProjectContext businessVertical '${projectContext.businessVertical}'.`);
  }

  if (projectContext) {
    if (plan.businessName !== projectContext.businessName) {
      issues.push(`BusinessPlan businessName '${plan.businessName}' conflicts with normalized ProjectContext businessName '${projectContext.businessName}'.`);
    }
    if (plan.country !== projectContext.country) {
      issues.push(`BusinessPlan country '${plan.country}' conflicts with normalized ProjectContext country '${projectContext.country}'.`);
    }
    if ((plan.city ?? null) !== (projectContext.city ?? null)) {
      issues.push(`BusinessPlan city '${plan.city ?? "null"}' conflicts with normalized ProjectContext city '${projectContext.city ?? "null"}'.`);
    }
    if ((plan.currency ?? null) !== (projectContext.currency ?? null)) {
      issues.push(`BusinessPlan currency '${plan.currency ?? "null"}' conflicts with normalized ProjectContext currency '${projectContext.currency ?? "null"}'.`);
    }
    if (normalizeToken(plan.businessStage) !== normalizeToken(projectContext.businessStage)) {
      issues.push(`BusinessPlan businessStage '${plan.businessStage}' conflicts with normalized ProjectContext businessStage '${projectContext.businessStage}'.`);
    }

    const contextChannels = getContextSalesChannels(projectContext).map(normalizeToken);
    const planChannelsNormalized = planSalesChannels.map(normalizeToken);
    const missingContextChannels = contextChannels.filter((channel) => !planChannelsNormalized.includes(channel));
    if (missingContextChannels.length > 0) {
      issues.push(
        `BusinessPlan salesChannels conflict with normalized ProjectContext salesChannels: expected to include [${contextChannels.join(", ")}], missing [${missingContextChannels.join(", ")}].`,
      );
    }
  }

  const genericRiskPatterns = [
    /^market\s+risk\.?$/i,
    /^competition\.?$/i,
    /^operational\s+risk\.?$/i,
    /^financial\s+risk\.?$/i,
    /^high\s+competition\.?$/i,
  ];
  for (const risk of plan.risks) {
    const normalizedRisk = risk.trim();
    if (normalizedRisk.length < 10) {
      issues.push("BusinessPlan risks must be specific and descriptive.");
      continue;
    }
    if (genericRiskPatterns.some((pattern) => pattern.test(normalizedRisk))) {
      issues.push(`BusinessPlan risk '${risk}' is too generic for production use.`);
    }
  }

  if (!Array.isArray(plan.assumptions) || plan.assumptions.length === 0) {
    issues.push("BusinessPlan must include assumptions.");
  }

  if (typeof plan.confidenceLevel !== "number" || plan.confidenceLevel < 0 || plan.confidenceLevel > 1) {
    issues.push("BusinessPlan must include confidenceLevel between 0 and 1.");
  }

  return issues;
}

const unsupportedMarketClaimPatterns = [
  /\b\d{2,}\s*(m|million|b|billion)\b/i,
  /\bguaranteed\b/i,
  /\bcertain\b/i,
];

const competitorPlaceholderPatterns = [
  /^competitor\s+[a-z]$/i,
  /\bplaceholder\b/i,
  /\bsample\b/i,
  /\bmock\b/i,
];

export function validateMarketResearchSemantics(report: MarketResearchReport): string[] {
  const issues: string[] = [];

  for (const claim of report.claims) {
    if (!hasText(claim.methodology)) {
      issues.push(`Market claim ${claim.claimId} must include methodology.`);
    }

    const looksUnsupported = unsupportedMarketClaimPatterns.some((pattern) => pattern.test(claim.claim));
    const isModelOnly = claim.evidenceType === "model_assumption" || claim.evidenceType === "requires_validation";
    if (looksUnsupported && isModelOnly && claim.validationStatus === "verified") {
      issues.push(`Market claim ${claim.claimId} presents unsupported claim as verified fact.`);
    }

    if (claim.evidenceType === "verified_source") {
      if (!hasText(claim.source) || !hasText(claim.sourceTitle) || !hasText(claim.sourceDate)) {
        issues.push(`Market claim ${claim.claimId} with evidenceType=verified_source must include source, sourceTitle, and sourceDate.`);
      }
      if (claim.validationStatus !== "verified" && claim.validationStatus !== "partially_verified") {
        issues.push(`Market claim ${claim.claimId} with evidenceType=verified_source must use validationStatus verified or partially_verified.`);
      }
    } else {
      if (claim.validationStatus === "verified") {
        issues.push(`Market claim ${claim.claimId} cannot use validationStatus=verified when evidenceType is ${claim.evidenceType}.`);
      }
    }
  }

  for (const competitor of report.competitors) {
    const isPlaceholder = competitorPlaceholderPatterns.some((pattern) => pattern.test(competitor.name));
    if (isPlaceholder) {
      issues.push(`Competitor '${competitor.name}' uses placeholder naming and must be removed.`);
    }
  }

  if (report.competitorDataStatus === "unavailable") {
    if (!report.unavailableCompetitorOutcome) {
      issues.push("MarketResearchReport must include unavailableCompetitorOutcome when competitorDataStatus is unavailable.");
    } else {
      if (report.unavailableCompetitorOutcome.competitorDataStatus !== "unavailable") {
        issues.push("unavailableCompetitorOutcome.competitorDataStatus must be 'unavailable'.");
      }
      if (!Array.isArray(report.unavailableCompetitorOutcome.competitorCategoriesToInvestigate)) {
        issues.push("unavailableCompetitorOutcome.competitorCategoriesToInvestigate must be an array.");
      }
      if (!Array.isArray(report.unavailableCompetitorOutcome.requiredResearchActions)) {
        issues.push("unavailableCompetitorOutcome.requiredResearchActions must be an array.");
      }
      if (!Array.isArray(report.unavailableCompetitorOutcome.suggestedSearchQueries)) {
        issues.push("unavailableCompetitorOutcome.suggestedSearchQueries must be an array.");
      }
      if (!Array.isArray(report.unavailableCompetitorOutcome.comparisonCriteria)) {
        issues.push("unavailableCompetitorOutcome.comparisonCriteria must be an array.");
      }
    }
    if (report.competitors.length > 0) {
      issues.push("MarketResearchReport cannot include competitors when competitorDataStatus is unavailable.");
    }
  } else if (report.unavailableCompetitorOutcome !== null) {
    issues.push("MarketResearchReport unavailableCompetitorOutcome must be null when competitorDataStatus is verified or partially_verified.");
  }

  return issues;
}
