import { describe, expect, it, vi } from "vitest";
import Orchestrator from "../orchestrator";
import type { Pipeline } from "../pipelines/pipelines";
import pipelines from "../pipelines/pipelines";
import agents from "../agents/definitions";
import mocks from "./mocks";
import { globalAgentFactory } from "../sdk/setup";
import { sdkAgentDefinitions } from "../agents/sdkDefinitions";

const reorderedDependencyPipeline: Pipeline = {
  id: "reordered_dependency_pipeline",
  name: "Reordered dependency pipeline",
  steps: [
    { id: "bs-1", agent: "business_strategist", description: "Generate BusinessPlan" },
    { id: "mr-1", agent: "market_research", description: "Generate MarketResearchReport", dependsOn: ["bs-1"] },
    { id: "fa-1", agent: "financial_analyst", description: "Generate FinancialModel", dependsOn: ["mr-1", "bs-1"] },
  ],
  requiredAgents: ["business_strategist", "market_research", "financial_analyst"],
  expectedOutputs: ["BusinessPlan", "MarketResearchReport", "FinancialModel"],
};

describe("upstream artifact resolution", () => {
  it("defines required inputArtifactTypes for the three production agents", () => {
    const strategist = sdkAgentDefinitions.find((item) => item.id === "business_strategist");
    const marketResearch = sdkAgentDefinitions.find((item) => item.id === "market_research");
    const financialAnalyst = sdkAgentDefinitions.find((item) => item.id === "financial_analyst");

    expect(strategist?.inputArtifactTypes).toEqual([]);
    expect(marketResearch?.inputArtifactTypes).toEqual(["BusinessPlan"]);
    expect(financialAnalyst?.inputArtifactTypes).toEqual(["BusinessPlan", "MarketResearchReport"]);
  });

  it("resolves upstream artifacts by type and agent id when dependency ordering changes", async () => {
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    orch.registerMockResponse("market_research", mocks.validMarketResearchReport);
    orch.registerMockResponse("financial_analyst", mocks.validFinancialModel);

    let capturedInput: Record<string, unknown> | null = null;
    const originalBuild = globalAgentFactory.build.bind(globalAgentFactory);
    const buildSpy = vi.spyOn(globalAgentFactory, "build");
    buildSpy.mockImplementation((definition, options) => {
      const executable = originalBuild(definition, options);
      return {
        ...executable,
        execute: async (ctx, rawInput) => {
          if (definition.id === "financial_analyst") {
            capturedInput = rawInput;
          }
          return executable.execute(ctx, rawInput);
        },
      };
    });

    try {
      const tasks = await orch.startPipeline(reorderedDependencyPipeline, "proj-upstream-order", {
        projectIdea: "Build business, market and financial outputs",
        projectContext: {
          projectId: "proj-upstream-order",
          businessName: "Eggreen",
          businessDescription: "Build business, market and financial outputs",
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
        },
      });

      expect(tasks.every((task) => task.status === "completed")).toBe(true);
      expect(capturedInput).toBeTruthy();

      const captured = capturedInput!;
      const dependencyOutputs = captured["dependencyOutputs"] as unknown[];
      const byType = captured["dependencyArtifactsByType"] as Record<string, unknown[]>;
      const byAgent = captured["dependencyArtifactsByAgent"] as Record<string, unknown[]>;

      expect(Array.isArray(dependencyOutputs)).toBe(true);
      expect(dependencyOutputs.length).toBe(2);
      expect(dependencyOutputs[0]).toEqual(mocks.validMarketResearchReport);
      expect(dependencyOutputs[1]).toEqual(mocks.validBusinessPlan);

      expect(byType.BusinessPlan?.[0]).toEqual(mocks.validBusinessPlan);
      expect(byType.MarketResearchReport?.[0]).toEqual(mocks.validMarketResearchReport);
      expect(byAgent.business_strategist?.[0]).toEqual(mocks.validBusinessPlan);
      expect(byAgent.market_research?.[0]).toEqual(mocks.validMarketResearchReport);
    } finally {
      buildSpy.mockRestore();
    }
  });
});
