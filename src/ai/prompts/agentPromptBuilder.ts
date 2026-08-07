import type { ProjectContext, VerticalTemplate } from "../context";
import { getVerticalTemplate, supportsSaasStylePricing } from "../context";
import type { AgentID } from "../types/agents";
import {
  EVIDENCE_TYPES,
  EVIDENCE_VALIDATION_STATUSES,
  MARKET_CLAIM_REQUIRED_FIELDS,
  MARKET_RESEARCH_REQUIRED_FIELDS,
  UNAVAILABLE_COMPETITOR_OUTCOME_REQUIRED_FIELDS,
} from "../contracts/outputContracts";

function formatLaunchTimeline(projectContext: ProjectContext): string {
  const { launchTimeline, launchTimelineMode, launchTimelineDays } = projectContext;
  if (!launchTimeline || !launchTimelineMode) {
    return "unresolved";
  }
  if (launchTimelineMode === "asap") {
    return "As soon as possible; no fixed day count";
  }
  if (launchTimelineMode === "flexible") {
    return "Flexible; no fixed day count";
  }
  if (launchTimelineDays != null) {
    return `${launchTimelineDays} days`;
  }
  return "unresolved";
}

export function buildAgentPrompt(params: {
  agentId: AgentID;
  projectContext: ProjectContext;
  upstreamArtifacts?: Record<string, unknown>;
  requiredSchemaName?: string;
}) {
  const { agentId, projectContext } = params;
  const template = getVerticalTemplate(projectContext.businessVertical);
  const primaryRevenueModel = projectContext.primaryRevenueModel ?? projectContext.revenueModelType;
  const secondaryRevenueModels = projectContext.secondaryRevenueModels ?? [];
  const salesChannels = projectContext.salesChannels ?? projectContext.revenueChannels ?? [];
  const revenueComponents = projectContext.revenueComponents ?? [];

  const common = [
    `Current date: ${projectContext.currentDate}`,
    `Context version: ${projectContext.contextVersion}`,
    `Business name: ${projectContext.businessName}`,
    `Business description: ${projectContext.businessDescription}`,
    `Industry: ${projectContext.industry}`,
    `Country: ${projectContext.country}`,
    `City: ${projectContext.city ?? "unresolved"}`,
    `Currency: ${projectContext.currency ?? "unresolved"}`,
    `Budget range: ${projectContext.budgetRange ?? "unresolved"}${
      projectContext.budgetMin != null || projectContext.budgetMax != null
        ? ` (min=${projectContext.budgetMin ?? "unbounded"}, max=${projectContext.budgetMax ?? "unbounded"} ${projectContext.currency ?? ""})`
        : ""
    }`,
    `Launch timeline: ${projectContext.launchTimeline ?? "unresolved"} (${formatLaunchTimeline(projectContext)})`,
    `Business vertical: ${projectContext.businessVertical} (confidence=${projectContext.businessVerticalConfidence.toFixed(2)})`,
    `Primary revenue model: ${primaryRevenueModel}`,
    `Secondary revenue models: ${secondaryRevenueModels.join(", ") || "none"}`,
    `Sales channels: ${salesChannels.join(", ") || "unresolved"}`,
    `Revenue components: ${revenueComponents.join(", ") || "unresolved"}`,
    `Selected goals: ${projectContext.selectedGoals.join(", ") || "none"}`,
    `Target audience: ${projectContext.targetAudience.join(", ") || "unresolved"}`,
  ].join("\n");

  const forbids = [
    "Do not invent verified sources or citations.",
    "Do not output placeholder competitor labels or sample company names.",
    "Do not output stale historical milestone dates earlier than projectCreatedAt unless explicitly marked user_provided historical facts.",
    "Do not output unlabeled monetary values; every amount must include currency.",
    "Do not output decorative or hardcoded scores.",
    "Do not output fake named competitors when data is unavailable.",
    "Do not output unsupported precise market size figures without methodology and confidence.",
    "Do not use unrelated industry terms that conflict with the selected vertical template.",
    "Do not fabricate external validation status.",
  ];

  if (!supportsSaasStylePricing({
    vertical: projectContext.businessVertical,
    revenueModel: primaryRevenueModel,
    secondary: secondaryRevenueModels,
  })) {
    forbids.push("Do not use SaaS pricing tiers Starter/Professional/Business/Enterprise.");
  }

  const policy = [
    "Each material claim must include sourceClassification: user_provided | verified_source | calculated_estimate | model_assumption | requires_validation | unavailable.",
    "If external validation is unavailable, mark claims as requires_validation or unavailable.",
  ].join("\n");

  if (agentId === "business_strategist") {
    const requiredBusinessPlanFields = [
      "businessName",
      "country",
      "city",
      "currency",
      "businessStage",
      "executiveSummary",
      "problem",
      "solution",
      "valueProposition",
      "targetMarket",
      "customerSegments",
      "businessVertical",
      "primaryRevenueModel",
      "secondaryRevenueModels",
      "operatingModel",
      "salesChannels",
      "revenueComponents",
      "competitiveAdvantage",
      "objectives",
      "milestones",
      "risks",
      "assumptions",
      "missingInputs",
      "confidenceLevel",
      "evidenceSummary",
      "generatedAt",
      "contextVersion",
      "verticalTemplateVersion",
      "sourceClassification",
    ];

    return [
      "You are the Business Strategist.",
      common,
      `Vertical template: ${serializeTemplate(template)}`,
      `Project created at: ${projectContext.projectCreatedAt}`,
      policy,
      `Required schema: ${params.requiredSchemaName ?? "BusinessPlan"}`,
      `Required top-level fields: ${requiredBusinessPlanFields.join(", ")}`,
      "Authoritative context fields must match ProjectContext exactly: businessName, country, city, currency, businessVertical, primaryRevenueModel, businessStage.",
      "Objectives must be measurable and tied to a realistic time horizon.",
      "Objectives must include id, statement, metric, targetValue, and timeHorizon.",
      "Milestones must include id/title/description/targetDate/dateSource/dependencies/confidence/assumptions.",
      "Each milestone targetDate must be current or future relative to projectCreatedAt unless explicitly user_provided historical context.",
      "Do not add fields outside the schema.",
      "Use sourceClassification enum values exactly as specified.",
      "Return JSON only.",
      ...forbids,
    ].join("\n\n");
  }

  if (agentId === "market_research") {
    return [
      "You are the Market Research Agent.",
      common,
      `Market taxonomy: ${template.marketResearchTaxonomy.join(", ")}`,
      `Competitor categories: ${template.competitorCategories.join(", ")}`,
      `Upstream artifacts: ${JSON.stringify(params.upstreamArtifacts ?? {})}`,
      policy,
      `Required schema: ${params.requiredSchemaName ?? "MarketResearchReport"}`,
      `Required top-level fields: ${MARKET_RESEARCH_REQUIRED_FIELDS.join(", ")}`,
      "If no verified data is available, provide structured unavailable outcomes and transparent estimation methods.",
      `Each claim must include exactly: ${MARKET_CLAIM_REQUIRED_FIELDS.join(", ")}.`,
      `evidenceType enum: ${EVIDENCE_TYPES.join(" | ")}.`,
      `validationStatus enum: ${EVIDENCE_VALIDATION_STATUSES.join(" | ")}.`,
      "evidenceType means what kind of evidence supports the claim.",
      "validationStatus means whether the claim has actually been validated.",
      "Example model-assumption claim fields: { \"evidenceType\": \"model_assumption\", \"validationStatus\": \"requires_external_research\", \"source\": null, \"sourceTitle\": null, \"sourceDate\": null }.",
      "Example verified-source claim fields: { \"evidenceType\": \"verified_source\", \"validationStatus\": \"verified\", \"source\": \"provider-supported source reference\", \"sourceTitle\": \"source title\", \"sourceDate\": \"2026-07-28\" }.",
      "Do not place evidenceType values inside validationStatus.",
      "If live research is unavailable: evidenceType must not be verified_source, validationStatus must not be verified, and source/sourceTitle/sourceDate must follow nullable contract.",
      "If competitors are unavailable, set competitorDataStatus=unavailable and provide structured research actions.",
      `When competitorDataStatus=unavailable, unavailableCompetitorOutcome must include: ${UNAVAILABLE_COMPETITOR_OUTCOME_REQUIRED_FIELDS.join(", ")}.`,
      "When competitorDataStatus is verified or partially_verified, set unavailableCompetitorOutcome to null.",
      "All unavailableCompetitorOutcome arrays must exist even when empty.",
      "Do not add fields outside the schema.",
      "Do not invent citations or sources.",
      "Return JSON only.",
      ...forbids,
    ].join("\n\n");
  }

  if (agentId === "financial_analyst") {
    return [
      "You are the Financial Analyst.",
      common,
      `Vertical financial drivers: ${template.revenueDrivers.join(", ")}`,
      `Vertical cost categories: ${template.costCategories.join(", ")}`,
      `Vertical KPIs: ${template.financialKPIs.join(", ")}`,
      `Upstream artifacts: ${JSON.stringify(params.upstreamArtifacts ?? {})}`,
      policy,
      `Required schema: ${params.requiredSchemaName ?? "FinancialModel"}`,
      "Return only one complete JSON object that exactly matches the schema.",
      "Do not return markdown, code fences, commentary, or prose.",
      "Keep reasoning text concise and compact.",
      "Keep assumptions concise; avoid repeated narrative.",
      "Use concise formulas that reference canonical inputValues entry names.",
      "Every calculation must expose formula, assumptions, confidence, and scenario.",
      "Every startupCosts and operatingCosts line item formula must reference every inputValues.name exactly.",
      "Every startupCosts and operatingCosts line item must include non-empty inputValues entries.",
      "Every financial amount must include currency and period (monthly/annual/one_time as applicable).",
      "Every monthlyRevenue/monthlyExpenses/grossProfit/netProfit object must include non-empty assumptions arrays.",
      "For each forecast scenario, enforce netProfit.amount = monthlyRevenue.amount - monthlyExpenses.amount within 1 unit tolerance.",
      "For restaurant_food_service, include exact canonical cost signals in costCategories: food_cost, packaging, payroll, rent.",
      "When using ingredient-related labels, still include canonical token food_cost explicitly.",
      "Currency must be a 3-letter code from ProjectContext and must preserve JOD when context currency is JOD.",
      "For restaurant_food_service, include restaurant-specific drivers and avoid SaaS metrics/tiers.",
      "Use vertical-specific drivers and categories; do not emit SaaS pricing or SaaS KPIs unless context explicitly supports it.",
      "Do not output Starter/Professional/Business/Enterprise pricing tiers for restaurant_food_service.",
      "Use exactly three forecast scenarios: conservative, expected, optimistic.",
      "Bound array sizes to stay compact while complete: startupCosts<=15, operatingCosts<=20, pricingRecommendation<=6, assumptions<=20, missingInputs<=20, evidenceSummary<=20.",
      "Ensure generatedAt and contextVersion are present and consistent with ProjectContext.",
      "Return JSON only.",
      ...forbids,
    ].join("\n\n");
  }

  return ["Return JSON only.", common, ...forbids].join("\n\n");
}

function serializeTemplate(template: VerticalTemplate) {
  return JSON.stringify(
    {
      verticalId: template.verticalId,
      applicableRevenueModels: template.applicableRevenueModels,
      revenueDrivers: template.revenueDrivers,
      costCategories: template.costCategories,
      financialKPIs: template.financialKPIs,
      forbiddenOutputPatterns: template.forbiddenOutputPatterns,
      defaultAssumptions: template.defaultAssumptions,
    },
    null,
    2,
  );
}
