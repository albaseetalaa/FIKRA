import type { AgentID } from "../types/agents";
import type { AgentDefinition, AgentExecutionContext } from "../sdk";
import { buildAgentPrompt } from "../prompts/agentPromptBuilder";
import { getOutputBudget } from "../providers/outputBudgets";
import { outputContracts } from "../sdk/outputContractRegistry";
import type { OutputModelName } from "../types/outputs";

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

function firstArtifactByType(rawInput: Record<string, unknown>, outputType: OutputModelName): unknown {
  const byType = rawInput.dependencyArtifactsByType as Record<string, unknown[]> | undefined;
  const candidates = byType?.[outputType];
  if (Array.isArray(candidates) && candidates.length > 0) {
    return candidates[0];
  }
  return undefined;
}

function baseDefinition(input: {
  id: AgentID;
  displayName: string;
  description: string;
  category: AgentDefinition["category"];
  outputArtifactType: AgentDefinition["outputArtifactType"];
  inputArtifactTypes?: AgentDefinition["inputArtifactTypes"];
  dependencies: AgentID[];
  optionalDependencies?: AgentID[];
  lifecycleHooks?: AgentDefinition["lifecycleHooks"];
  enabled?: boolean;
  selectableByDefault?: boolean;
}): AgentDefinition {
  const budget =
    input.outputArtifactType === "BusinessPlan"
      ? getOutputBudget("BusinessPlan")
      : input.outputArtifactType === "MarketResearchReport"
        ? getOutputBudget("MarketResearchReport")
        : input.outputArtifactType === "FinancialModel"
          ? getOutputBudget("FinancialModel")
          : { base: 1200, max: 2200 };

  const contract = outputContracts[input.outputArtifactType];

  return {
    id: input.id,
    version: contract.version,
    displayName: input.displayName,
    description: input.description,
    category: input.category,
    supportedVerticals: ["any"],
    requiredCapabilities: ["external_api"],
    requiredProjectContextFields: ["businessName", "businessDescription", "country", "businessVertical", "revenueModelType"],
    inputArtifactTypes: input.inputArtifactTypes ?? [],
    outputArtifactType: input.outputArtifactType,
    promptBuilder: (ctx: AgentExecutionContext) =>
      buildAgentPrompt({
        agentId: input.id,
        projectContext: ctx.projectContext,
        upstreamArtifacts: ctx.upstreamArtifacts,
        requiredSchemaName: input.outputArtifactType,
      }),
    providerSchema: (ctx) => contract.providerSchema(ctx.projectContext),
    structuralValidator: (raw, ctx) => contract.structuralValidator(raw, ctx.projectContext),
    semanticValidator: (raw, ctx) => contract.semanticValidator(raw, ctx.projectContext),
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
    lifecycleHooks: input.lifecycleHooks,
    evaluationFixtures: {
      deterministicSuiteNames: [],
    },
    selectableByDefault: input.selectableByDefault ?? (input.enabled ?? true),
    enabled: input.enabled ?? true,
  };
}

const businessStrategistDefinition = baseDefinition({
  id: "business_strategist",
  displayName: "Business Strategist",
  description: "Crafts high-level business strategy and priorities.",
  category: "strategy",
  outputArtifactType: "BusinessPlan",
  inputArtifactTypes: [],
  dependencies: [],
  lifecycleHooks: {
    prepareInput: (_ctx, rawInput) => ({
      ...rawInput,
      projectIdea: typeof rawInput.projectIdea === "string" ? rawInput.projectIdea : rawInput.projectSummary,
    }),
  },
});

const marketResearchDefinition = baseDefinition({
  id: "market_research",
  displayName: "Market Research Agent",
  description: "Collects market data, customer segments and trends.",
  category: "research",
  outputArtifactType: "MarketResearchReport",
  inputArtifactTypes: ["BusinessPlan"],
  dependencies: ["business_strategist"],
  lifecycleHooks: {
    prepareInput: (_ctx, rawInput) => {
      const businessPlan = firstArtifactByType(rawInput, "BusinessPlan");
      const derivedTargetMarket =
        businessPlan && typeof businessPlan === "object" && "targetMarket" in (businessPlan as Record<string, unknown>)
          ? (businessPlan as { targetMarket?: unknown }).targetMarket
          : undefined;

      return {
        ...rawInput,
        businessPlan,
        projectIdea: typeof rawInput.projectIdea === "string" ? rawInput.projectIdea : rawInput.projectSummary,
        targetMarketContext:
          typeof rawInput.targetMarketContext === "string"
            ? rawInput.targetMarketContext
            : typeof derivedTargetMarket === "string"
              ? derivedTargetMarket
              : "",
      };
    },
  },
});

const financialAnalystDefinition = baseDefinition({
  id: "financial_analyst",
  displayName: "Financial Analyst",
  description: "Builds financial projections, budgets and models.",
  category: "finance",
  outputArtifactType: "FinancialModel",
  inputArtifactTypes: ["BusinessPlan", "MarketResearchReport"],
  dependencies: ["business_strategist", "market_research"],
  lifecycleHooks: {
    prepareInput: (_ctx, rawInput) => {
      const businessPlan = firstArtifactByType(rawInput, "BusinessPlan");
      const marketResearchReport = firstArtifactByType(rawInput, "MarketResearchReport");
      const targetMarket =
        businessPlan && typeof businessPlan === "object" && "targetMarket" in (businessPlan as Record<string, unknown>)
          ? (businessPlan as { targetMarket?: unknown }).targetMarket
          : undefined;

      return {
        ...rawInput,
        businessPlan,
        marketResearchReport,
        projectIdea: typeof rawInput.projectIdea === "string" ? rawInput.projectIdea : rawInput.projectSummary,
        targetMarket: typeof targetMarket === "string" ? targetMarket : "",
      };
    },
  },
});

export const sdkAgentDefinitions: AgentDefinition[] = [
  businessStrategistDefinition,
  marketResearchDefinition,
  financialAnalystDefinition,
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
