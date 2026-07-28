import { describe, it, expect } from "vitest";
import Orchestrator from "../orchestrator";
import pipelines from "../pipelines/pipelines";
import agents from "../agents/definitions";
import mocks from "./mocks";
import { globalArtifactStore } from "../store/setup";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import { globalProviderManager } from "../providers/manager";
import type AIProvider from "../providers/interface";

describe("Orchestrator validation flow", () => {
  it("stores valid agent outputs and marks task completed", async () => {
    const orch = new Orchestrator(pipelines, agents);
    // register a valid business plan for the business_strategist
    orch.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    const tasks = await orch.startPipeline("business_strategist_only", "proj-1");
    const task = tasks.find((t) => t.step.agent === "business_strategist");
    expect(task).toBeDefined();
    expect(task?.status).toBe("completed");
  });

  it("rejects invalid outputs and marks task failed", async () => {
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.invalidBusinessPlan);
    const tasks = await orch.startPipeline("business_strategist_only", "proj-2");
    const task = tasks.find((t) => t.step.agent === "business_strategist");
    expect(task).toBeDefined();
    expect(task?.status).toBe("failed");
    expect(task!.attempts.length).toBeGreaterThan(0);
    const attempt = task!.attempts[0]!;
    expect(attempt).toBeDefined();
    expect(attempt.error).toBeDefined();
  });

  it("handles malformed JSON as retryable then fails if retries exhausted", async () => {
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.malformedResponse);
    // also add a valid one to see retry behavior; but since malformed is retryable, if no more responses, it should fail
    const tasks = await orch.startPipeline("business_strategist_only", "proj-3");
    const task = tasks.find((t) => t.step.agent === "business_strategist");
    expect(task).toBeDefined();
    expect(task?.status).toBe("failed");
    expect(task!.attempts.length).toBeGreaterThanOrEqual(1);
    const attempt2 = task!.attempts[0]!;
    expect(attempt2).toBeDefined();
    expect(attempt2.error).toBeDefined();
  });

  it("executes Business Strategist -> Market Research -> Financial Analyst in order", async () => {
    const executionOrder: string[] = [];
    const orch = new Orchestrator(pipelines, agents, undefined, {
      onTaskChanged(task) {
        if (task.status === "completed") executionOrder.push(task.step.agent);
      },
    });

    orch.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    orch.registerMockResponse("market_research", mocks.validMarketResearchReport);
    orch.registerMockResponse("financial_analyst", mocks.validFinancialModel);

    const tasks = await orch.startPipeline("business_strategist_market_research", "proj-order", { projectIdea: "Test idea" }, "run-order");
    expect(tasks.every((task) => task.status === "completed")).toBe(true);
    expect(executionOrder).toEqual(["business_strategist", "market_research", "financial_analyst"]);
  });

  it("isolates downstream financial failure while preserving upstream artifacts", async () => {
    (globalArtifactStore as InMemoryArtifactStore).clear();

    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    orch.registerMockResponse("market_research", mocks.validMarketResearchReport);
    orch.registerMockResponse("financial_analyst", { startupCosts: "bad" });

    const tasks = await orch.startPipeline("business_strategist_market_research", "proj-isolation", { projectIdea: "Test idea" }, "run-isolation");
    const businessTask = tasks.find((task) => task.step.agent === "business_strategist");
    const marketTask = tasks.find((task) => task.step.agent === "market_research");
    const financialTask = tasks.find((task) => task.step.agent === "financial_analyst");
    expect(businessTask?.status).toBe("completed");
    expect(marketTask?.status).toBe("completed");
    expect(financialTask?.status).toBe("failed");

    const artifacts = await globalArtifactStore.list("proj-isolation");
    const businessPlans = artifacts.filter((artifact) => artifact.outputType === "BusinessPlan");
    const marketReports = artifacts.filter((artifact) => artifact.outputType === "MarketResearchReport");
    const financialModels = artifacts.filter((artifact) => artifact.outputType === "FinancialModel");

    expect(businessPlans.length).toBe(1);
    expect(marketReports.length).toBe(1);
    expect(financialModels.length).toBe(0);
  });

  it("passes validated upstream context to Market Research and Financial Analyst", async () => {
    const prompts: string[] = [];
    const provider: AIProvider = {
      id: "capture",
      name: "Capture Provider",
      async invoke(prompt, options) {
        prompts.push(prompt);
        const agentId = options?.agentId;
        if (agentId === "business_strategist") {
          return {
            providerId: "capture",
            model: "capture-model",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            output: mocks.validBusinessPlan,
          };
        }
        if (agentId === "market_research") {
          return {
            providerId: "capture",
            model: "capture-model",
            usage: { inputTokens: 11, outputTokens: 21, totalTokens: 32 },
            output: mocks.validMarketResearchReport,
          };
        }
        return {
          providerId: "capture",
          model: "capture-model",
          usage: { inputTokens: 13, outputTokens: 24, totalTokens: 37 },
          output: mocks.validFinancialModel,
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

    globalProviderManager.register(provider);
    const orch = new Orchestrator(
      pipelines,
      agents,
      {
        business_strategist: { provider: "capture", model: "capture-model" },
        market_research: { provider: "capture", model: "capture-model" },
        financial_analyst: { provider: "capture", model: "capture-model" },
        brand_strategist: { provider: "mock", model: "mock-model" },
        naming_expert: { provider: "mock", model: "mock-model" },
        logo_director: { provider: "mock", model: "mock-model" },
        visual_identity: { provider: "mock", model: "mock-model" },
        website_architect: { provider: "mock", model: "mock-model" },
        marketing_strategist: { provider: "mock", model: "mock-model" },
        operations_consultant: { provider: "mock", model: "mock-model" },
        pitch_deck_expert: { provider: "mock", model: "mock-model" },
        growth_advisor: { provider: "mock", model: "mock-model" },
      },
    );

    try {
      const projectIdea = "A modern AI-powered restaurant branding agency for startups.";
      const tasks = await orch.startPipeline("business_strategist_market_research", "proj-context", { projectIdea }, "run-context");
      expect(tasks.every((task) => task.status === "completed")).toBe(true);

      const marketPrompt = prompts.find((prompt) => prompt.includes("Market Research Agent"));
      const financialPrompt = prompts.find((prompt) => prompt.includes("Financial Analyst"));
      expect(marketPrompt).toBeDefined();
      expect(marketPrompt).toContain(projectIdea);
      expect(marketPrompt).toContain("Small businesses in MENA");
      expect(financialPrompt).toBeDefined();
      expect(financialPrompt).toContain(projectIdea);
      expect(financialPrompt).toContain("marketSizeEstimate");
      expect(financialPrompt).toContain("Small businesses in MENA");
    } finally {
      globalProviderManager.clear();
    }
  });
});
