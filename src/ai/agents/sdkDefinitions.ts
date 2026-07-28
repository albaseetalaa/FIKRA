import type { AgentID } from "../types/agents";
import type { AgentDefinition, AgentExecutionContext } from "../sdk";
import { buildAgentPrompt } from "../prompts/agentPromptBuilder";
import { getProviderOutputSchema } from "../providers/outputSchemas";
import { validateModel } from "../validation/validator";
import {
  validateBusinessPlanSemantics,
  validateFinancialModelSemantics,
  validateMarketResearchSemantics,
} from "../validation/semanticValidators";
import { getOutputBudget } from "../providers/outputBudgets";

function buildDefaultRepairPrompt(input: {
  originalPrompt: string;
  issues: string[];
  outputType: string;
}) {
  return [
    input.originalPrompt,
    "",
    "Validation issues to fix:",
    ...input.issues.map((issue) => `- ${issue}`),
    "",
    `Return one corrected JSON object only for ${input.outputType}.`,
    "Do not include markdown or commentary.",
  ].join("\n");
}

function baseDefinition(input: {
  id: AgentID;
  displayName: string;
  description: string;
  category: AgentDefinition["category"];
  outputArtifactType: AgentDefinition["outputArtifactType"];
  dependencies: AgentID[];
  optionalDependencies?: AgentID[];
  enabled?: boolean;
}): AgentDefinition {
  const budget =
    input.outputArtifactType === "BusinessPlan"
      ? getOutputBudget("BusinessPlan")
      : input.outputArtifactType === "MarketResearchReport"
        ? getOutputBudget("MarketResearchReport")
        : input.outputArtifactType === "FinancialModel"
          ? getOutputBudget("FinancialModel")
          : { base: 1200, max: 2200 };

  return {
    id: input.id,
    version: "1.0.0",
    displayName: input.displayName,
    description: input.description,
    category: input.category,
    supportedVerticals: ["any"],
    requiredCapabilities: ["external_api"],
    requiredProjectContextFields: ["businessName", "businessDescription", "country", "businessVertical", "revenueModelType"],
    inputArtifactTypes: [],
    outputArtifactType: input.outputArtifactType,
    promptBuilder: (ctx: AgentExecutionContext) =>
      buildAgentPrompt({
        agentId: input.id,
        projectContext: ctx.projectContext,
        upstreamArtifacts: ctx.upstreamArtifacts,
        requiredSchemaName: input.outputArtifactType,
      }),
    providerSchema: (ctx) => getProviderOutputSchema(input.outputArtifactType, ctx.projectContext),
    structuralValidator: (raw, ctx) => validateModel(input.outputArtifactType, raw, { projectContext: ctx.projectContext }),
    semanticValidator: (raw, ctx) => {
      const parsed = validateModel(input.outputArtifactType, raw, { projectContext: ctx.projectContext });
      if (!parsed.success) return parsed.errors.map((item) => item.message);
      if (input.outputArtifactType === "BusinessPlan") {
        return validateBusinessPlanSemantics(parsed.value as never, ctx.projectContext);
      }
      if (input.outputArtifactType === "MarketResearchReport") {
        return validateMarketResearchSemantics(parsed.value as never);
      }
      if (input.outputArtifactType === "FinancialModel") {
        return validateFinancialModelSemantics(parsed.value as never, ctx.projectContext);
      }
      return [];
    },
    tokenBudget: {
      initialOutputTokens: budget.base,
      repairOutputTokens: Math.min(budget.max, budget.base + 600),
      maxOutputTokens: budget.max,
    },
    retryPolicy: {
      maxProviderCalls: 3,
      maxRepairAttempts: 2,
      transportRetriesPerCall: 2,
    },
    repairPolicy: {
      enabled: true,
      buildRepairPrompt: ({ originalPrompt, issues, outputType }) =>
        buildDefaultRepairPrompt({ originalPrompt, issues, outputType }),
    },
    timeoutPolicy: {
      timeoutMs: 60000,
    },
    persistencePolicy: {
      persistInvalidAttempts: true,
      persistValidArtifactsOnly: true,
    },
    dependencies: input.dependencies,
    optionalDependencies: input.optionalDependencies ?? [],
    lifecycleHooks: {
      prepareInput: (ctx, rawInput) => {
        const dependencyOutputs = Array.isArray(rawInput.dependencyOutputs)
          ? (rawInput.dependencyOutputs as unknown[])
          : [];

        if (input.id === "market_research") {
          const businessPlan = dependencyOutputs[0];
          const projectIdea = typeof rawInput.projectIdea === "string"
            ? rawInput.projectIdea
            : rawInput.projectSummary;
          const derivedTargetMarket =
            businessPlan && typeof businessPlan === "object" && "targetMarket" in (businessPlan as Record<string, unknown>)
              ? (businessPlan as { targetMarket?: unknown }).targetMarket
              : undefined;

          return {
            ...rawInput,
            businessPlan,
            projectIdea,
            targetMarketContext: typeof rawInput.targetMarketContext === "string"
              ? rawInput.targetMarketContext
              : typeof derivedTargetMarket === "string"
                ? derivedTargetMarket
                : "",
          };
        }

        if (input.id === "financial_analyst") {
          const businessPlan = dependencyOutputs.find(
            (value) => value && typeof value === "object" && (
              "primaryRevenueModel" in (value as Record<string, unknown>)
              || "revenueModel" in (value as Record<string, unknown>)
            ),
          );
          const marketResearchReport = dependencyOutputs.find(
            (value) => value && typeof value === "object" && "marketSizeEstimate" in (value as Record<string, unknown>),
          );
          const targetMarket =
            businessPlan && typeof businessPlan === "object" && "targetMarket" in businessPlan
              ? (businessPlan as { targetMarket?: unknown }).targetMarket
              : undefined;

          return {
            ...rawInput,
            businessPlan,
            marketResearchReport,
            projectIdea: typeof rawInput.projectIdea === "string" ? rawInput.projectIdea : rawInput.projectSummary,
            targetMarket: typeof targetMarket === "string" ? targetMarket : "",
          };
        }

        return rawInput;
      },
    },
    evaluationFixtures: {
      deterministicSuiteNames: [],
    },
    enabled: input.enabled ?? true,
  };
}

export const sdkAgentDefinitions: AgentDefinition[] = [
  baseDefinition({
    id: "business_strategist",
    displayName: "Business Strategist",
    description: "Crafts high-level business strategy and priorities.",
    category: "strategy",
    outputArtifactType: "BusinessPlan",
    dependencies: [],
  }),
  baseDefinition({
    id: "market_research",
    displayName: "Market Research Agent",
    description: "Collects market data, customer segments and trends.",
    category: "research",
    outputArtifactType: "MarketResearchReport",
    dependencies: ["business_strategist"],
  }),
  baseDefinition({
    id: "financial_analyst",
    displayName: "Financial Analyst",
    description: "Builds financial projections, budgets and models.",
    category: "finance",
    outputArtifactType: "FinancialModel",
    dependencies: ["business_strategist", "market_research"],
  }),
  baseDefinition({
    id: "brand_strategist",
    displayName: "Brand Strategist",
    description: "Defines brand positioning and messaging.",
    category: "brand",
    outputArtifactType: "BrandStrategy",
    dependencies: [],
    enabled: false,
  }),
  baseDefinition({
    id: "naming_expert",
    displayName: "Naming Expert",
    description: "Generates and filters name candidates.",
    category: "brand",
    outputArtifactType: "ProjectSummary",
    dependencies: [],
    enabled: false,
  }),
  baseDefinition({
    id: "logo_director",
    displayName: "Logo Director",
    description: "Produces logo concepts and variations.",
    category: "brand",
    outputArtifactType: "LogoConcept",
    dependencies: [],
    enabled: false,
  }),
  baseDefinition({
    id: "visual_identity",
    displayName: "Visual Identity",
    description: "Defines visual identity system.",
    category: "brand",
    outputArtifactType: "VisualIdentity",
    dependencies: [],
    enabled: false,
  }),
  baseDefinition({
    id: "website_architect",
    displayName: "Website Architect",
    description: "Designs information architecture for web experiences.",
    category: "operations",
    outputArtifactType: "WebsiteStructure",
    dependencies: ["business_strategist"],
    enabled: false,
  }),
  baseDefinition({
    id: "marketing_strategist",
    displayName: "Marketing Strategist",
    description: "Plans channels and campaigns.",
    category: "growth",
    outputArtifactType: "MarketingPlan",
    dependencies: ["business_strategist"],
    enabled: false,
  }),
  baseDefinition({
    id: "operations_consultant",
    displayName: "Operations Consultant",
    description: "Builds operational blueprint.",
    category: "operations",
    outputArtifactType: "OperationsPlan",
    dependencies: ["business_strategist"],
    enabled: false,
  }),
  baseDefinition({
    id: "pitch_deck_expert",
    displayName: "Pitch Deck Expert",
    description: "Creates investor pitch structure.",
    category: "growth",
    outputArtifactType: "PitchDeck",
    dependencies: ["business_strategist", "financial_analyst"],
    enabled: false,
  }),
  baseDefinition({
    id: "growth_advisor",
    displayName: "Growth Advisor",
    description: "Recommends growth initiatives.",
    category: "growth",
    outputArtifactType: "GrowthRoadmap",
    dependencies: ["business_strategist", "market_research", "financial_analyst"],
    enabled: false,
  }),
];
