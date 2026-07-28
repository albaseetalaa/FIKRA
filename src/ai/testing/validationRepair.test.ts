import { describe, expect, it } from "vitest";
import Orchestrator from "../orchestrator";
import pipelines from "../pipelines/pipelines";
import agents from "../agents/definitions";
import defaultModels from "../providers/models";
import { globalProviderManager } from "../providers/manager";
import type AIProvider from "../providers/interface";
import { validBusinessPlan, validFinancialModel, validMarketResearchReport } from "./mocks";
import { globalArtifactStore } from "../store/setup";
import { InMemoryArtifactStore } from "../store/inMemoryStore";

function baseResult(output: unknown) {
  return {
    providerId: "repair-test",
    model: "repair-model",
    requestId: "req_1",
    output,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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

function buildTestModels() {
  return {
    ...defaultModels,
    business_strategist: { ...defaultModels.business_strategist, provider: "repair-test", model: "repair-model" },
    market_research: { ...defaultModels.market_research, provider: "repair-test", model: "repair-model" },
    financial_analyst: { ...defaultModels.financial_analyst, provider: "repair-test", model: "repair-model" },
  };
}

describe("validation-aware repair loop", () => {
  it("repairs structural validation failure successfully", async () => {
    const provider: AIProvider = {
      id: "repair-test",
      name: "Repair Test",
      async invoke(_prompt, options) {
        if (options?.agentId === "business_strategist") {
          const count = (this as unknown as { count?: number }).count ?? 0;
          (this as unknown as { count: number }).count = count + 1;
          if (count === 0) {
            const invalid = { ...validBusinessPlan } as Record<string, unknown>;
            delete invalid.executiveSummary;
            return baseResult(invalid);
          }
          return baseResult(validBusinessPlan);
        }
        if (options?.agentId === "market_research") return baseResult(validMarketResearchReport);
        return baseResult(validFinancialModel);
      },
      async health() {
        return { ok: true };
      },
      async models() {
        return ["repair-model"];
      },
      async validateConfiguration() {
        return true;
      },
    };

    globalProviderManager.register(provider);
    (globalArtifactStore as InMemoryArtifactStore).clear();

    const orch = new Orchestrator(pipelines, agents, buildTestModels());
    const tasks = await orch.startPipeline(
      "business_strategist_market_research",
      "proj-repair-struct",
      { projectIdea: "Eggreen healthy breakfast in Amman" },
      "run-repair-struct",
    );

    const bs = tasks.find((t) => t.step.agent === "business_strategist");
    expect(bs?.status).toBe("completed");
    expect(bs?.attempts.length).toBe(2);
  });

  it("repairs semantic validation failure successfully", async () => {
    const provider: AIProvider = {
      id: "repair-test",
      name: "Repair Test",
      async invoke(_prompt, options) {
        if (options?.agentId === "business_strategist") {
          const count = (this as unknown as { count?: number }).count ?? 0;
          (this as unknown as { count: number }).count = count + 1;
          if (count === 0) {
            return baseResult({
              ...validBusinessPlan,
              objectives: [
                {
                  id: "obj-generic",
                  statement: "grow the business",
                  metric: "",
                  targetValue: "",
                  timeHorizon: "",
                },
              ],
            });
          }
          return baseResult(validBusinessPlan);
        }
        if (options?.agentId === "market_research") return baseResult(validMarketResearchReport);
        return baseResult(validFinancialModel);
      },
      async health() {
        return { ok: true };
      },
      async models() {
        return ["repair-model"];
      },
      async validateConfiguration() {
        return true;
      },
    };

    globalProviderManager.clear();
    globalProviderManager.register(provider);
    const orch = new Orchestrator(pipelines, agents, buildTestModels());
    const tasks = await orch.startPipeline(
      "business_strategist_market_research",
      "proj-repair-semantic",
      { projectIdea: "Eggreen healthy breakfast in Amman" },
      "run-repair-semantic",
    );

    const bs = tasks.find((t) => t.step.agent === "business_strategist");
    expect(bs?.status).toBe("completed");
    expect(bs?.attempts.length).toBe(2);
    const firstDiag = bs?.attempts[0]?.validationDiagnostic;
    expect(firstDiag?.validationStage).toBe("semantic_validation");
  });

  it("exhausts repair attempts and does not rerun completed upstream tasks", async () => {
    let marketCalls = 0;
    const provider: AIProvider = {
      id: "repair-test",
      name: "Repair Test",
      async invoke(_prompt, options) {
        if (options?.agentId === "business_strategist") {
          const invalid = { ...validBusinessPlan } as Record<string, unknown>;
          delete invalid.executiveSummary;
          return baseResult(invalid);
        }
        if (options?.agentId === "market_research") {
          marketCalls += 1;
          return baseResult(validMarketResearchReport);
        }
        return baseResult(validFinancialModel);
      },
      async health() {
        return { ok: true };
      },
      async models() {
        return ["repair-model"];
      },
      async validateConfiguration() {
        return true;
      },
    };

    globalProviderManager.clear();
    globalProviderManager.register(provider);
    (globalArtifactStore as InMemoryArtifactStore).clear();

    const orch = new Orchestrator(pipelines, agents, buildTestModels());
    const tasks = await orch.startPipeline(
      "business_strategist_market_research",
      "proj-repair-exhaust",
      { projectIdea: "Eggreen healthy breakfast in Amman" },
      "run-repair-exhaust",
    );

    const bs = tasks.find((t) => t.step.agent === "business_strategist");
    const mr = tasks.find((t) => t.step.agent === "market_research");
    expect(bs?.status).toBe("failed");
    expect(bs?.attempts.length).toBe(3);
    expect(mr).toBeUndefined();
    expect(marketCalls).toBe(0);

    const artifacts = await globalArtifactStore.list("proj-repair-exhaust");
    expect(artifacts.filter((a) => a.outputType === "BusinessPlan").length).toBe(0);
  });

  it("keeps provider transport retries separate from schema repair", async () => {
    let calls = 0;
    const provider: AIProvider = {
      id: "repair-test",
      name: "Repair Test",
      async invoke(_prompt, options) {
        if (options?.agentId === "business_strategist") {
          calls += 1;
          if (calls === 1) {
            const err = new Error("timeout");
            (err as { name?: string }).name = "AbortError";
            throw err;
          }
          if (calls === 2) {
            const invalid = { ...validBusinessPlan } as Record<string, unknown>;
            delete invalid.executiveSummary;
            return baseResult(invalid);
          }
          return baseResult(validBusinessPlan);
        }
        if (options?.agentId === "market_research") return baseResult(validMarketResearchReport);
        return baseResult(validFinancialModel);
      },
      async health() {
        return { ok: true };
      },
      async models() {
        return ["repair-model"];
      },
      async validateConfiguration() {
        return true;
      },
    };

    globalProviderManager.clear();
    globalProviderManager.register(provider);

    const orch = new Orchestrator(pipelines, agents, buildTestModels());
    const tasks = await orch.startPipeline(
      "business_strategist_market_research",
      "proj-retry-separate",
      { projectIdea: "Eggreen healthy breakfast in Amman" },
      "run-retry-separate",
    );

    const bs = tasks.find((t) => t.step.agent === "business_strategist");
    expect(bs?.status).toBe("completed");
    expect(bs?.attempts.length).toBe(2);
    expect(calls).toBe(3);
  });

  it("fails immediately on non-retryable authentication error", async () => {
    const provider: AIProvider = {
      id: "repair-test",
      name: "Repair Test",
      async invoke(_prompt, options) {
        if (options?.agentId === "business_strategist") {
          const error = new Error("Unauthorized") as Error & { status?: number; name?: string };
          error.status = 401;
          error.name = "OpenAIAPIError";
          throw error;
        }
        return baseResult(validBusinessPlan);
      },
      async health() {
        return { ok: true };
      },
      async models() {
        return ["repair-model"];
      },
      async validateConfiguration() {
        return true;
      },
    };

    globalProviderManager.clear();
    globalProviderManager.register(provider);

    const orch = new Orchestrator(pipelines, agents, buildTestModels());
    const tasks = await orch.startPipeline("business_strategist_only", "proj-auth-fail", { projectIdea: "x" }, "run-auth-fail");
    const bs = tasks.find((t) => t.step.agent === "business_strategist");
    expect(bs?.status).toBe("failed");
    expect(bs?.attempts.length).toBe(1);
  });

  it("classifies truncated response and keeps diagnostic sanitized", async () => {
    const provider: AIProvider = {
      id: "repair-test",
      name: "Repair Test",
      async invoke(_prompt, options) {
        if (options?.agentId === "business_strategist") {
          const count = (this as unknown as { count?: number }).count ?? 0;
          (this as unknown as { count: number }).count = count + 1;
          if (count === 0) {
            return {
              providerId: "repair-test",
              model: "repair-model",
              requestId: "req_1",
              output: "{\"executiveSummary\":\"short",
              usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
              metadata: {
                startedAt: "2026-07-28T00:00:00.000Z",
                completedAt: "2026-07-28T00:00:01.000Z",
                parsedJson: false,
                rawResponseAvailable: true,
                rawResponseTruncated: true,
                refusalDetected: false,
                truncatedDetected: true,
                finishReason: "max_output_tokens",
                responseStatus: "incomplete",
              },
            };
          }
          return baseResult(validBusinessPlan);
        }
        if (options?.agentId === "market_research") return baseResult(validMarketResearchReport);
        return baseResult(validFinancialModel);
      },
      async health() {
        return { ok: true };
      },
      async models() {
        return ["repair-model"];
      },
      async validateConfiguration() {
        return true;
      },
    };

    globalProviderManager.clear();
    globalProviderManager.register(provider);
    const orch = new Orchestrator(pipelines, agents, buildTestModels());
    const tasks = await orch.startPipeline("business_strategist_only", "proj-truncated", { projectIdea: "x" }, "run-truncated");
    const bs = tasks.find((t) => t.step.agent === "business_strategist");
    expect(bs?.status).toBe("completed");
    const diag = bs?.attempts[0]?.validationDiagnostic;
    expect(diag?.rawResponseTruncated).toBe(true);
    expect(diag?.invalidJson).toBe(true);
  });
});
