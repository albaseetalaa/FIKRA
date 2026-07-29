import { afterEach, describe, expect, it, vi } from "vitest";
import Orchestrator from "../orchestrator";
import pipelines from "../pipelines/pipelines";
import agents from "../agents/definitions";
import mocks from "./mocks";
import { globalAgentFactory } from "../sdk/setup";
import { globalProviderManager } from "../providers/manager";
import type AIProvider from "../providers/interface";
import { CEOOrchestrator } from "../ceo";
import { AgentRegistry } from "../sdk/agentRegistry";
import { sdkAgentDefinitions } from "../agents/sdkDefinitions";
import defaultModels, { type ModelConfig } from "../providers/models";
import { normalizeProjectContext } from "../context";
import type { ProjectContext } from "../context";

const eggreenContext: ProjectContext = {
  projectId: "proj_eggreen",
  businessName: "Eggreen",
  businessDescription: "Healthy breakfast restaurant",
  industry: "Restaurant & Food",
  businessStage: "planning",
  country: "Jordan",
  city: "Amman",
  currency: "JOD",
  currencySource: "country_default",
  targetAudience: ["professionals"],
  customerAgeRange: null,
  customerType: "Individuals",
  budgetRange: null,
  budgetCurrency: null,
  launchTimeline: "Within 3 months",
  selectedGoals: ["Develop strategy"],
  currentDate: "2026-07-28T00:00:00.000Z",
  projectCreatedAt: "2026-07-28T00:00:00.000Z",
  businessVertical: "restaurant_food_service",
  businessVerticalConfidence: 0.9,
  primaryRevenueModel: "transaction_sales",
  secondaryRevenueModels: [],
  salesChannels: ["dine_in", "takeaway", "drive_thru", "delivery"],
  revenueComponents: ["transaction_sales", "delivery_fee", "add_on_products"],
  revenueModelType: "transaction_sales",
  revenueChannels: ["dine_in", "takeaway", "drive_thru", "delivery"],
  businessModelCategory: "transaction_sales",
  contextVersion: "1.0.0",
};

function createMarketingPlanFixture() {
  return {
    channels: ["social", "search"],
    budgetAllocation: {
      social: 60,
      search: 40,
    },
    timeline: [
      {
        task: "launch awareness campaign",
        date: "2026-08-01",
      },
    ],
  };
}

function createModelOverrides(): Record<string, ModelConfig> {
  return {
    ...defaultModels,
    business_strategist: { ...defaultModels.business_strategist, provider: "capture", model: "capture-model" },
    market_research: { ...defaultModels.market_research, provider: "capture", model: "capture-model" },
    financial_analyst: { ...defaultModels.financial_analyst, provider: "capture", model: "capture-model" },
    marketing_strategist: { ...defaultModels.marketing_strategist, provider: "capture", model: "capture-model" },
  };
}

afterEach(() => {
  globalProviderManager.clear();
  vi.restoreAllMocks();
});

describe("SDK runtime integration", () => {
  it("does not silently bypass SDK for legacy input without projectContext", async () => {
    const buildSpy = vi.spyOn(globalAgentFactory, "build");
    const orch = new Orchestrator(pipelines, agents);
    const normalized = normalizeProjectContext({
      projectId: "proj-legacy-sdk",
      businessName: "Legacy Match",
      businessDescription: "Restaurant breakfast concept for Jordan offices",
      industry: "Restaurant",
      country: "Jordan",
      city: "Amman",
      currency: "JOD",
      customerType: "Individuals",
      businessStage: "planning",
      currentDate: "2026-07-28T00:00:00.000Z",
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
      selectedGoals: ["launch"],
      targetAudience: "professionals",
    }).context;

    orch.registerMockResponse("business_strategist", {
      ...mocks.validBusinessPlan,
      businessName: normalized.businessName,
      country: normalized.country,
      city: normalized.city,
      currency: normalized.currency,
      businessVertical: normalized.businessVertical,
      primaryRevenueModel: normalized.primaryRevenueModel,
      secondaryRevenueModels: normalized.secondaryRevenueModels,
      salesChannels: normalized.salesChannels,
      revenueComponents: normalized.revenueComponents,
    });

    const tasks = await orch.startPipeline("business_strategist_only", "proj-legacy-sdk", {
      businessName: "Legacy Match",
      projectIdea: "Restaurant breakfast concept for Jordan offices",
      industry: "Restaurant",
      country: "Jordan",
      city: "Amman",
      currency: "JOD",
      currentDate: "2026-07-28T00:00:00.000Z",
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
    });

    expect(tasks[0]?.status).toBe("completed");
    expect(buildSpy).toHaveBeenCalled();
  });

  it("executes the three existing agents through SDK factory", async () => {
    const buildSpy = vi.spyOn(globalAgentFactory, "build");
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    orch.registerMockResponse("market_research", mocks.validMarketResearchReport);
    orch.registerMockResponse("financial_analyst", mocks.validFinancialModel);

    const tasks = await orch.startPipeline("business_strategist_market_research", "proj-sdk-three", {
      projectIdea: "Create strategy, market research, and financial model for Eggreen.",
      projectContext: eggreenContext,
    });

    expect(tasks.every((task) => task.status === "completed")).toBe(true);
    const builtAgentIds = buildSpy.mock.calls.map((call) => call[0].id);
    expect(builtAgentIds).toEqual(["business_strategist", "market_research", "financial_analyst"]);
  });

  it("respects disabled agents when planning", () => {
    const registry = new AgentRegistry();
    const enabledBusiness = sdkAgentDefinitions.find((item) => item.id === "business_strategist");
    const disabledMarket = sdkAgentDefinitions.find((item) => item.id === "market_research");
    const disabledFinancial = sdkAgentDefinitions.find((item) => item.id === "financial_analyst");

    registry.register({ ...enabledBusiness!, enabled: true });
    registry.register({ ...disabledMarket!, enabled: false });
    registry.register({ ...disabledFinancial!, enabled: false });

    const ceo = new CEOOrchestrator(pipelines, agents, { agentRegistry: registry });
    const plan = ceo.determineExecutionPlan("Build a complete startup plan with strategy and finance details.");

    expect(plan.selectedAgents).toEqual(["business_strategist"]);
  });

  it("plans and executes a registered synthetic agent without orchestrator code changes", async () => {
    const captureProvider: AIProvider = {
      id: "capture",
      name: "Capture Provider",
      async invoke(_prompt, options) {
        if (options?.agentId === "marketing_strategist") {
          return {
            providerId: "capture",
            model: "capture-model",
            output: createMarketingPlanFixture(),
          };
        }
        return {
          providerId: "capture",
          model: "capture-model",
          output: mocks.validBusinessPlan,
        };
      },
      async health() {
        return { ok: true };
      },
      async models() {
        return ["capture-model"];
      },
      async validateConfiguration() {
        return true;
      },
    };

    globalProviderManager.register(captureProvider);

    const registry = new AgentRegistry();
    const marketing = sdkAgentDefinitions.find((item) => item.id === "marketing_strategist");
    registry.register({
      ...marketing!,
      enabled: true,
      dependencies: [],
      optionalDependencies: [],
      requiredCapabilities: ["external_api"],
    });

    const ceo = new CEOOrchestrator(
      pipelines,
      agents,
      {
        agentRegistry: registry,
        models: createModelOverrides(),
      },
    );

    const result = await ceo.execute({
      projectId: "proj-synthetic-agent",
      workflowRunId: "run-synthetic-agent",
      projectIdea: "Plan and execute only a marketing strategy workflow for launch readiness.",
    });

    expect(result.success).toBe(true);
    expect(result.tasks.length).toBe(1);
    expect(result.tasks[0]?.step.agent).toBe("marketing_strategist");
    expect(result.tasks[0]?.status).toBe("completed");
  });

  it("uses SDK path for CEO resume execution", async () => {
    const buildSpy = vi.spyOn(globalAgentFactory, "build");
    const ceo = new CEOOrchestrator(pipelines, agents);

    const paused = await ceo.execute({
      projectId: "proj-sdk-resume",
      workflowRunId: "run-sdk-resume",
      projectIdea: "short",
      projectContext: eggreenContext,
    });

    ceo.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    ceo.registerMockResponse("market_research", mocks.validMarketResearchReport);
    ceo.registerMockResponse("financial_analyst", mocks.validFinancialModel);

    const resumed = await ceo.resumeFromCheckpoint(paused.checkpoint!, {
      additionalContext: "Build complete strategy, market research, and financial workflow output.",
    });

    expect(resumed.success).toBe(true);
    expect(buildSpy).toHaveBeenCalled();
  });
});
