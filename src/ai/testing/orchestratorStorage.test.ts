import { describe, it, expect, beforeEach } from "vitest";
import Orchestrator from "../orchestrator";
import pipelines from "../pipelines/pipelines";
import agents from "../agents/definitions";
import mocks from "./mocks";
import { globalArtifactStore } from "../store/setup";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import type { ProjectContext } from "../context";
import { createProjectContextFixture } from "../context";

const eggreenContext: ProjectContext = createProjectContextFixture({
  projectId: "proj_eggreen",
  businessName: "Eggreen",
  businessDescription: "Healthy breakfast restaurant",
});

describe("Orchestrator storage and provider flow", () => {
  beforeEach(() => {
    (globalArtifactStore as InMemoryArtifactStore).clear();
  });

  it("stores valid three-agent orchestrator outputs", async () => {
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    orch.registerMockResponse("market_research", mocks.validMarketResearchReport);
    orch.registerMockResponse("financial_analyst", mocks.validFinancialModel);
    const tasks = await orch.startPipeline(
      "business_strategist_market_research",
      "proj-store-1",
      { projectIdea: "Idea", projectContext: eggreenContext },
      "run-store-1",
    );

    expect(tasks.every((task) => task.status === "completed")).toBe(true);
    const saved = await globalArtifactStore.list("proj-store-1");
    const businessPlans = saved.filter((item) => item.outputType === "BusinessPlan");
    const marketReports = saved.filter((item) => item.outputType === "MarketResearchReport");
    const financialModels = saved.filter((item) => item.outputType === "FinancialModel");
    expect(businessPlans.length).toBe(1);
    expect(marketReports.length).toBe(1);
    expect(financialModels.length).toBe(1);
    expect(saved.every((item) => typeof item.taskId === "string" && item.taskId.startsWith("run-store-1:"))).toBe(true);
    expect(saved.every((item) => item.validationStatus === "valid")).toBe(true);
  });

  it("isolates financial failure without deleting strategist and market artifacts", async () => {
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    orch.registerMockResponse("market_research", mocks.validMarketResearchReport);
    orch.registerMockResponse("financial_analyst", { startupCosts: "bad" });
    const tasks = await orch.startPipeline(
      "business_strategist_market_research",
      "proj-store-2",
      { projectIdea: "Idea", projectContext: eggreenContext },
      "run-store-2",
    );

    const businessTask = tasks.find((task) => task.step.agent === "business_strategist");
    const marketTask = tasks.find((task) => task.step.agent === "market_research");
    const financialTask = tasks.find((task) => task.step.agent === "financial_analyst");
    expect(businessTask?.status).toBe("completed");
    expect(marketTask?.status).toBe("completed");
    expect(financialTask?.status).toBe("failed");
    const saved = await globalArtifactStore.list("proj-store-2");
    expect(saved.filter((item) => item.outputType === "BusinessPlan").length).toBe(1);
    expect(saved.filter((item) => item.outputType === "MarketResearchReport").length).toBe(1);
    expect(saved.filter((item) => item.outputType === "FinancialModel").length).toBe(0);
  });

  it("executes full provider → normalize → validate → store flow for three agents", async () => {
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    orch.registerMockResponse("market_research", mocks.validMarketResearchReport);
    orch.registerMockResponse("financial_analyst", mocks.validFinancialModel);
    const tasks = await orch.startPipeline(
      "business_strategist_market_research",
      "proj-flow-1",
      { projectIdea: "Idea", projectContext: eggreenContext },
      "run-flow-1",
    );
    expect(tasks.every((task) => task.status === "completed")).toBe(true);
    const saved = await globalArtifactStore.list("proj-flow-1");
    expect(saved.length).toBe(3);
    expect(saved.some((artifact) => artifact.outputType === "BusinessPlan" && JSON.stringify(artifact.content) === JSON.stringify(mocks.validBusinessPlan))).toBe(true);
    expect(saved.some((artifact) => artifact.outputType === "MarketResearchReport" && JSON.stringify(artifact.content) === JSON.stringify(mocks.validMarketResearchReport))).toBe(true);
    expect(saved.some((artifact) => artifact.outputType === "FinancialModel" && JSON.stringify(artifact.content) === JSON.stringify(mocks.validFinancialModel))).toBe(true);
  });
});
