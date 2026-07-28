import { afterEach, describe, expect, it } from "vitest";
import { agents } from "../agents/definitions";
import { CEOOrchestrator } from "../ceo";
import { pipelines } from "../pipelines/pipelines";
import { globalProviderManager } from "../providers/manager";
import type AIProvider from "../providers/interface";
import type { ModelConfig } from "../providers/models";
import defaultModels from "../providers/models";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import { globalArtifactStore } from "../store/setup";
import type { AgentID } from "../types/agents";
import { type RetryPolicy } from "../reliability";
import * as mocks from "./mocks";

function createRetryModels(): Record<string, ModelConfig> {
  const base = { ...defaultModels } as Record<string, ModelConfig>;
  const ids: AgentID[] = ["business_strategist", "market_research", "financial_analyst"];
  for (const id of ids) {
    base[id] = { ...base[id], provider: "retry-provider", model: "retry-model" };
  }
  return base;
}

function createProvider(failuresByAgent: Partial<Record<AgentID, number>>, invokeCount: Record<string, number>): AIProvider {
  return {
    id: "retry-provider",
    name: "Retry Provider",
    async invoke(_prompt, options) {
      const agentId = String(options?.agentId ?? "unknown");
      invokeCount[agentId] = (invokeCount[agentId] ?? 0) + 1;

      const remaining = failuresByAgent[agentId as AgentID] ?? 0;
      if (remaining > 0) {
        failuresByAgent[agentId as AgentID] = remaining - 1;
        throw new Error("Provider timeout");
      }

      if (agentId === "business_strategist") {
        return { providerId: "retry-provider", model: "retry-model", output: mocks.validBusinessPlan };
      }
      if (agentId === "market_research") {
        return { providerId: "retry-provider", model: "retry-model", output: mocks.validMarketResearchReport };
      }
      if (agentId === "financial_analyst") {
        return { providerId: "retry-provider", model: "retry-model", output: mocks.validFinancialModel };
      }

      return { providerId: "retry-provider", model: "retry-model", output: {} };
    },
    async health() {
      return { ok: true };
    },
    async models() {
      return ["retry-model"];
    },
    async validateConfiguration() {
      return true;
    },
  };
}

const retryPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 0,
  maxDelayMs: 0,
  backoffStrategy: "fixed",
  retryableErrorCodes: ["AGENT_EXECUTION_FAILED"],
  retryableErrorTypes: ["Error"],
};

afterEach(() => {
  globalProviderManager.clear();
  (globalArtifactStore as InMemoryArtifactStore).clear();
});

describe("CEO retry integration", () => {
  it("executes successfully after retry and downstream tasks continue after recovery", async () => {
    const invokeCount: Record<string, number> = {};
    globalProviderManager.register(createProvider({ market_research: 1 }, invokeCount));

    const ceo = new CEOOrchestrator(pipelines, agents, {
      models: createRetryModels(),
      retryPolicy,
      sleepFn: async () => {},
    });

    const execution = await ceo.execute({
      projectId: "proj-retry-recover",
      workflowRunId: "run-retry-recover",
      projectIdea: "Run retry recovery path for market research then continue downstream.",
    });

    expect(execution.success).toBe(true);
    expect(invokeCount.business_strategist).toBe(1);
    expect(invokeCount.market_research).toBe(2);
    expect(invokeCount.financial_analyst).toBe(1);

    const planArtifacts = (await globalArtifactStore.list("proj-retry-recover"))
      .filter((artifact) => artifact.outputType === "ExecutionPlan")
      .map((artifact) => artifact.content as { currentStatus?: string });

    expect(planArtifacts.some((p) => p.currentStatus === "retrying")).toBe(true);
    expect(planArtifacts.some((p) => p.currentStatus === "running")).toBe(true);
    expect(planArtifacts.some((p) => p.currentStatus === "completed")).toBe(true);
  });

  it("does not run downstream tasks when dependency permanently fails", async () => {
    const invokeCount: Record<string, number> = {};
    globalProviderManager.register(createProvider({ market_research: 5 }, invokeCount));

    const ceo = new CEOOrchestrator(pipelines, agents, {
      models: createRetryModels(),
      retryPolicy: { ...retryPolicy, maxAttempts: 2 },
      sleepFn: async () => {},
    });

    const execution = await ceo.execute({
      projectId: "proj-retry-fail",
      workflowRunId: "run-retry-fail",
      projectIdea: "Dependency should fail permanently and stop downstream.",
    });

    expect(execution.success).toBe(false);
    expect(execution.plan.currentStatus).toBe("failed");
    expect(invokeCount.business_strategist).toBe(1);
    expect(invokeCount.market_research).toBe(2);
    expect(invokeCount.financial_analyst ?? 0).toBe(0);
  });

  it("retries only failed task and does not rerun already completed tasks", async () => {
    const invokeCount: Record<string, number> = {};
    globalProviderManager.register(createProvider({ financial_analyst: 1 }, invokeCount));

    const ceo = new CEOOrchestrator(pipelines, agents, {
      models: createRetryModels(),
      retryPolicy,
      sleepFn: async () => {},
    });

    const execution = await ceo.execute({
      projectId: "proj-retry-failed-task-only",
      workflowRunId: "run-retry-failed-task-only",
      projectIdea: "Retry only failed task while preserving completed task outputs.",
    });

    expect(execution.success).toBe(true);
    expect(invokeCount.business_strategist).toBe(1);
    expect(invokeCount.market_research).toBe(1);
    expect(invokeCount.financial_analyst).toBe(2);
  });
});
