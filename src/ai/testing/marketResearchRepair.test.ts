import { describe, expect, it } from "vitest";
import Orchestrator from "../orchestrator";
import pipelines from "../pipelines/pipelines";
import agents from "../agents/definitions";
import defaultModels from "../providers/models";
import { globalProviderManager } from "../providers/manager";
import type AIProvider from "../providers/interface";
import type { ProjectContext } from "../context";
import { validBusinessPlan, validFinancialModel, validMarketResearchReport } from "./mocks";
import { globalArtifactStore } from "../store/setup";
import { InMemoryArtifactStore } from "../store/inMemoryStore";

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

function baseResult(output: unknown) {
  return {
    providerId: "market-repair-test",
    model: "market-repair-model",
    requestId: "req_market_1",
    output,
    usage: { inputTokens: 12, outputTokens: 24, totalTokens: 36 },
    metadata: {
      startedAt: "2026-07-28T00:00:00.000Z",
      completedAt: "2026-07-28T00:00:01.000Z",
      parsedJson: typeof output !== "string",
      rawResponseAvailable: true,
      rawResponseTruncated: false,
      refusalDetected: false,
      truncatedDetected: false,
      finishReason: null,
      responseStatus: "completed",
    },
  };
}

function buildModels() {
  return {
    ...defaultModels,
    business_strategist: { ...defaultModels.business_strategist, provider: "market-repair-test", model: "market-repair-model" },
    market_research: { ...defaultModels.market_research, provider: "market-repair-test", model: "market-repair-model" },
    financial_analyst: { ...defaultModels.financial_analyst, provider: "market-repair-test", model: "market-repair-model" },
  };
}

function createProvider(marketOutputs: unknown[]): AIProvider {
  let marketCalls = 0;

  return {
    id: "market-repair-test",
    name: "Market Repair Test",
    async invoke(_prompt, options) {
      if (options?.agentId === "business_strategist") {
        return baseResult(validBusinessPlan);
      }

      if (options?.agentId === "market_research") {
        const index = Math.min(marketCalls, marketOutputs.length - 1);
        marketCalls += 1;
        return baseResult(marketOutputs[index]);
      }

      return baseResult(validFinancialModel);
    },
    async health() {
      return { ok: true };
    },
    async models() {
      return ["market-repair-model"];
    },
    async validateConfiguration() {
      return true;
    },
  };
}

describe("MarketResearchReport validation-aware repair", () => {
  it("repairs evidenceType/validationStatus enum confusion and continues workflow", async () => {
    const invalidReport = {
      ...validMarketResearchReport,
      claims: validMarketResearchReport.claims.map((claim) => ({
        ...claim,
        validationStatus: "verified_source",
      })),
    };

    globalProviderManager.clear();
    globalProviderManager.register(createProvider([invalidReport, validMarketResearchReport]));
    (globalArtifactStore as InMemoryArtifactStore).clear();

    const orch = new Orchestrator(pipelines, agents, buildModels());
    const tasks = await orch.startPipeline("business_strategist_market_research", "proj-market-repair-1", {
      projectIdea: "Eggreen healthy breakfast in Amman",
      projectContext: eggreenContext,
    }, "run-market-repair-1");

    const mr = tasks.find((task) => task.step.agent === "market_research");
    const fa = tasks.find((task) => task.step.agent === "financial_analyst");

    expect(mr?.status).toBe("completed");
    expect(fa?.status).toBe("completed");
  });

  it("repairs missing claim fields and completes downstream FinancialModel", async () => {
    const invalidClaimReport = {
      ...validMarketResearchReport,
      claims: [
        (() => {
          const invalid = { ...validMarketResearchReport.claims[0]! } as Record<string, unknown>;
          delete invalid.generatedAt;
          delete invalid.source;
          return invalid;
        })(),
      ],
    };

    globalProviderManager.clear();
    globalProviderManager.register(createProvider([invalidClaimReport, validMarketResearchReport]));
    (globalArtifactStore as InMemoryArtifactStore).clear();

    const orch = new Orchestrator(pipelines, agents, buildModels());
    const tasks = await orch.startPipeline("business_strategist_market_research", "proj-market-repair-2", {
      projectIdea: "Eggreen healthy breakfast in Amman",
      projectContext: eggreenContext,
    }, "run-market-repair-2");

    const mr = tasks.find((task) => task.step.agent === "market_research");
    const fa = tasks.find((task) => task.step.agent === "financial_analyst");

    expect(mr?.status).toBe("completed");
    expect(fa?.status).toBe("completed");
  });

  it("exhausts MarketResearchReport repair attempts and never persists invalid report", async () => {
    const invalidReport = {
      ...validMarketResearchReport,
      claims: [
        {
          ...validMarketResearchReport.claims[0]!,
          validationStatus: "verified_source",
        },
      ],
    };

    globalProviderManager.clear();
    globalProviderManager.register(createProvider([invalidReport, invalidReport, invalidReport]));
    (globalArtifactStore as InMemoryArtifactStore).clear();

    const orch = new Orchestrator(pipelines, agents, buildModels());
    const tasks = await orch.startPipeline("business_strategist_market_research", "proj-market-repair-3", {
      projectIdea: "Eggreen healthy breakfast in Amman",
      projectContext: eggreenContext,
    }, "run-market-repair-3");

    const mr = tasks.find((task) => task.step.agent === "market_research");
    const fa = tasks.find((task) => task.step.agent === "financial_analyst");
    expect(mr?.status).toBe("failed");
    expect(fa).toBeUndefined();

    const artifacts = await globalArtifactStore.list("proj-market-repair-3");
    expect(artifacts.filter((artifact) => artifact.outputType === "MarketResearchReport").length).toBe(0);
  });

  it("runs full deterministic BusinessPlan -> MarketResearchReport -> FinancialModel chain", async () => {
    globalProviderManager.clear();
    globalProviderManager.register(createProvider([validMarketResearchReport]));
    (globalArtifactStore as InMemoryArtifactStore).clear();

    const orch = new Orchestrator(pipelines, agents, buildModels());
    const tasks = await orch.startPipeline("business_strategist_market_research", "proj-market-repair-4", {
      projectIdea: "Eggreen healthy breakfast in Amman",
      projectContext: eggreenContext,
    }, "run-market-repair-4");

    expect(tasks.length).toBe(3);
    expect(tasks.every((task) => task.status === "completed")).toBe(true);

    const artifacts = await globalArtifactStore.list("proj-market-repair-4");
    expect(artifacts.filter((artifact) => artifact.outputType === "BusinessPlan").length).toBe(1);
    expect(artifacts.filter((artifact) => artifact.outputType === "MarketResearchReport").length).toBe(1);
    expect(artifacts.filter((artifact) => artifact.outputType === "FinancialModel").length).toBe(1);
  });
});
