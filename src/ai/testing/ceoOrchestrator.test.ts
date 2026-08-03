import { describe, expect, it } from "vitest";
import { agents } from "../agents/definitions";
import { CEOOrchestrator } from "../ceo";
import { pipelines } from "../pipelines/pipelines";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import { globalArtifactStore } from "../store/setup";
import * as mocks from "./mocks";
import type { ProjectContext } from "../context";
import { createProjectContextFixture } from "../context";
import { AgentRegistry } from "../sdk/agentRegistry";
import { sdkAgentDefinitions } from "../agents/sdkDefinitions";

const eggreenContext: ProjectContext = createProjectContextFixture({
  projectId: "proj_eggreen",
  businessName: "Eggreen",
  businessDescription: "Healthy breakfast restaurant",
});

describe("CEO Orchestrator", () => {
  it("builds a typed execution plan dynamically", () => {
    const ceo = new CEOOrchestrator(pipelines, agents);
    const plan = ceo.determineExecutionPlan("Build a full startup launch plan with strategy, market research, and financial model.");

    expect(plan.workflowId.startsWith("ceo_dynamic_")).toBe(true);
    expect(plan.selectedAgents).toEqual(["business_strategist", "market_research", "financial_analyst"]);
    expect(plan.executionOrder).toEqual(["business_strategist", "market_research", "financial_analyst"]);
    expect(plan.expectedArtifacts).toEqual(["BusinessPlan", "MarketResearchReport", "FinancialModel"]);
    expect(plan.currentStatus).toBe("planning");
  });

  it("creates a valid dependency graph", () => {
    const ceo = new CEOOrchestrator(pipelines, agents);
    const plan = ceo.determineExecutionPlan("Need strategy and market sizing for a B2B AI startup.");

    expect(plan.dependencyGraph.business_strategist).toEqual([]);
    expect(plan.dependencyGraph.market_research).toEqual(["business_strategist"]);
    expect(plan.dependencyGraph.financial_analyst).toEqual(["business_strategist", "market_research"]);

    const checks = ceo.validatePrerequisites(plan);
    expect(checks.ok).toBe(true);
    expect(checks.issues.length).toBe(0);
  });

  it("tracks execution state and marks completion under CEO control", async () => {
    (globalArtifactStore as InMemoryArtifactStore).clear();

    const ceo = new CEOOrchestrator(pipelines, agents);
    ceo.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    ceo.registerMockResponse("market_research", mocks.validMarketResearchReport);
    ceo.registerMockResponse("financial_analyst", mocks.validFinancialModel);

    const execution = await ceo.execute({
      projectId: "proj-ceo-state",
      workflowRunId: "run-ceo-state",
      projectIdea: "Create a startup plan with strategy, market validation, and financial projections.",
      projectContext: eggreenContext,
    });

    expect(execution.success).toBe(true);
    expect(execution.state.status).toBe("completed");
    expect(execution.state.completedAgents).toEqual(["business_strategist", "market_research", "financial_analyst"]);
    expect(execution.state.failedAgents).toEqual([]);
    expect(execution.tasks.length).toBe(3);
  });

  it("runs successful three-agent execution using mock outputs", async () => {
    (globalArtifactStore as InMemoryArtifactStore).clear();

    const ceo = new CEOOrchestrator(pipelines, agents);
    ceo.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    ceo.registerMockResponse("market_research", mocks.validMarketResearchReport);
    ceo.registerMockResponse("financial_analyst", mocks.validFinancialModel);

    const result = await ceo.execute({
      projectId: "proj-ceo-success",
      workflowRunId: "run-ceo-success",
      projectIdea: "Launch a new AI service with full business, market, and finance planning.",
      projectContext: eggreenContext,
    });

    expect(result.success).toBe(true);
    expect(result.tasks.every((task) => task.status === "completed")).toBe(true);

    const artifacts = await globalArtifactStore.list("proj-ceo-success");
    expect(artifacts.filter((item) => item.outputType === "BusinessPlan").length).toBe(1);
    expect(artifacts.filter((item) => item.outputType === "MarketResearchReport").length).toBe(1);
    expect(artifacts.filter((item) => item.outputType === "FinancialModel").length).toBe(1);
    expect(artifacts.filter((item) => item.outputType === "ExecutionPlan").length).toBeGreaterThanOrEqual(1);
  });

  it("pauses when project input is insufficient and emits checkpoint", async () => {
    (globalArtifactStore as InMemoryArtifactStore).clear();

    const ceo = new CEOOrchestrator(pipelines, agents);
    const execution = await ceo.execute({
      projectId: "proj-ceo-pause",
      workflowRunId: "run-ceo-pause",
      projectIdea: "short",
    });

    expect(execution.success).toBe(false);
    expect(execution.outcome).toBe("paused");
    expect(execution.state.status).toBe("waiting_for_user");
    expect(execution.pauseReason).toBe("requires_user_input");
    expect(execution.userInputRequest).toBeDefined();
    expect(execution.checkpoint).toBeDefined();
    expect(execution.checkpoint?.workflowStatus).toBe("waiting_for_user");
  });

  it("resumes from checkpoint and completes workflow", async () => {
    (globalArtifactStore as InMemoryArtifactStore).clear();

    const ceo = new CEOOrchestrator(pipelines, agents);
    const paused = await ceo.execute({
      projectId: "proj-ceo-resume",
      workflowRunId: "run-ceo-resume",
      projectIdea: "short",
      projectContext: eggreenContext,
    });

    expect(paused.outcome).toBe("paused");
    expect(paused.checkpoint).toBeDefined();

    ceo.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    ceo.registerMockResponse("market_research", mocks.validMarketResearchReport);
    ceo.registerMockResponse("financial_analyst", mocks.validFinancialModel);

    const resumed = await ceo.resumeFromCheckpoint(paused.checkpoint!, {
      additionalContext: "Build a complete startup launch plan with strategy, market research, and a financial model.",
    });

    expect(resumed.outcome).toBe("completed");
    expect(resumed.success).toBe(true);
    expect(resumed.state.status).toBe("completed");
    expect(resumed.tasks.length).toBe(3);
    expect(resumed.tasks.every((task) => task.status === "completed")).toBe(true);
  });

  it("does not auto-select unrelated enabled agents without typed request matches", () => {
    const registry = new AgentRegistry();
    const strategist = sdkAgentDefinitions.find((item) => item.id === "business_strategist");
    const growthAdvisor = sdkAgentDefinitions.find((item) => item.id === "growth_advisor");
    registry.register({ ...strategist!, enabled: true, selectableByDefault: false });
    registry.register({ ...growthAdvisor!, enabled: true, selectableByDefault: false, dependencies: [] });

    const ceo = new CEOOrchestrator(pipelines, agents, { agentRegistry: registry });
    const plan = ceo.determineExecutionPlan("Build a focused business strategy for launch", {
      requestedCategories: ["strategy"],
    });

    expect(plan.selectedAgents).toEqual(["business_strategist"]);
  });

  it("selects by requestedArtifactTypes and adds dependencies generically", () => {
    const ceo = new CEOOrchestrator(pipelines, agents);
    const plan = ceo.determineExecutionPlan("Need only financial outputs", {
      requestedArtifactTypes: ["FinancialModel"],
    });

    expect(plan.selectedAgents).toEqual(["business_strategist", "market_research", "financial_analyst"]);
    expect(plan.dependencyGraph.financial_analyst).toEqual(["business_strategist", "market_research"]);
  });

  it("selects by requestedCategories", () => {
    const ceo = new CEOOrchestrator(pipelines, agents);
    const plan = ceo.determineExecutionPlan("Need finance coverage", {
      requestedCategories: ["finance"],
    });

    expect(plan.selectedAgents).toContain("financial_analyst");
    expect(plan.selectedAgents).toContain("market_research");
    expect(plan.selectedAgents).toContain("business_strategist");
  });

  it("selects by requestedCapabilities", () => {
    const ceo = new CEOOrchestrator(pipelines, agents);
    const plan = ceo.determineExecutionPlan("Need external analysis", {
      requestedCapabilities: ["external_api"],
    });

    expect(plan.selectedAgents).toEqual(["business_strategist", "market_research", "financial_analyst"]);
  });

  it("selects explicitly requested synthetic agent without orchestrator modification", () => {
    const registry = new AgentRegistry();
    const marketing = sdkAgentDefinitions.find((item) => item.id === "marketing_strategist");
    registry.register({ ...marketing!, enabled: true, dependencies: [] });

    const ceo = new CEOOrchestrator(pipelines, agents, { agentRegistry: registry });
    const plan = ceo.determineExecutionPlan("Run requested marketing workflow", {
      requestedAgentIds: ["marketing_strategist"],
    });

    expect(plan.selectedAgents).toEqual(["marketing_strategist"]);
  });
});
