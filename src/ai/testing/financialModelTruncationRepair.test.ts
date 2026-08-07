import { describe, expect, it } from "vitest";
import Orchestrator from "../orchestrator";
import pipelines from "../pipelines/pipelines";
import agents from "../agents/definitions";
import defaultModels from "../providers/models";
import { globalProviderManager } from "../providers/manager";
import type AIProvider from "../providers/interface";
import type { ProjectContext } from "../context";
import { createProjectContextFixture } from "../context";
import { validBusinessPlan, validFinancialModel, validMarketResearchReport } from "./mocks";
import { globalArtifactStore } from "../store/setup";
import { executeAgentLifecycle } from "../sdk/lifecycle";
import { outputContracts } from "../sdk/outputContractRegistry";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import type { AgentExecutionContext } from "../sdk/types";
import { ProviderManager } from "../providers/manager";

const eggreenContext: ProjectContext = createProjectContextFixture({
  projectId: "proj_eggreen",
  businessName: "Eggreen",
  businessDescription: "Healthy breakfast restaurant",
});

function baseResult(output: unknown) {
  return {
    providerId: "truncate-test",
    model: "truncate-model",
    requestId: "req-trunc",
    output,
    usage: { inputTokens: 100, outputTokens: 3000, totalTokens: 3100 },
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
      responseFormat: "json_schema",
      parsingClassification: typeof output === "string" ? "valid_json_text" : "native_structured_object",
      parsingStage: typeof output === "string" ? "json_text_parse" : "provider_native_parsed",
      incompleteReason: null,
      responseCharLength: typeof output === "string" ? output.length : 0,
      configuredMaxOutputTokens: 3600,
    },
  };
}

function buildModels() {
  return {
    ...defaultModels,
    business_strategist: { ...defaultModels.business_strategist, provider: "truncate-test", model: "truncate-model" },
    market_research: { ...defaultModels.market_research, provider: "truncate-test", model: "truncate-model" },
    financial_analyst: { ...defaultModels.financial_analyst, provider: "truncate-test", model: "truncate-model", maxTokens: 3600 },
  };
}

describe("FinancialModel truncation repair", () => {
  it("recovers from truncated FinancialModel response on retry", async () => {
    let totalCalls = 0;
    let financialCalls = 0;
    const financialMaxTokens: number[] = [];

    const provider: AIProvider = {
      id: "truncate-test",
      name: "truncate-test",
      async invoke(_prompt, options) {
        totalCalls += 1;
        if (options?.agentId === "business_strategist") return baseResult(validBusinessPlan);
        if (options?.agentId === "market_research") return baseResult(validMarketResearchReport);
        if (options?.agentId === "financial_analyst") {
          financialCalls += 1;
          financialMaxTokens.push(Number(options?.maxTokens ?? 0));
          if (financialCalls === 1) {
            return {
              ...baseResult('{"verticalId":"restaurant_food_service"'),
              metadata: {
                ...baseResult("").metadata,
                parsedJson: false,
                rawResponseTruncated: true,
                truncatedDetected: true,
                finishReason: "max_output_tokens",
                responseStatus: "incomplete",
                parsingClassification: "truncated_json",
                parsingStage: "json_parse_failed",
                incompleteReason: "max_output_tokens",
                responseCharLength: 38,
                configuredMaxOutputTokens: Number(options?.maxTokens ?? 3600),
              },
            };
          }
          return baseResult(validFinancialModel);
        }
        return baseResult(validFinancialModel);
      },
      async health() {
        return { ok: true };
      },
      async models() {
        return ["truncate-model"];
      },
      async validateConfiguration() {
        return true;
      },
    };

    globalProviderManager.clear();
    globalProviderManager.register(provider);

    const orch = new Orchestrator(pipelines, agents, buildModels());
    const tasks = await orch.startPipeline(
      "business_strategist_market_research",
      "proj-fin-trunc-repair",
      { projectIdea: "Eggreen healthy breakfast in Amman", projectContext: eggreenContext },
      "run-fin-trunc-repair",
    );

    const fin = tasks.find((task) => task.step.agent === "financial_analyst");
    expect(fin?.status).toBe("completed");
    expect(totalCalls).toBe(4);
    expect(financialCalls).toBe(2);
    expect(financialMaxTokens.length).toBe(2);
    expect(financialMaxTokens[1]!).toBeGreaterThan(financialMaxTokens[0]!);

    const artifacts = await globalArtifactStore.list("proj-fin-trunc-repair");
    const validFinancial = artifacts.filter(
      (item) => item.outputType === "FinancialModel" && item.validationStatus === "valid",
    );
    const invalidFinancial = artifacts.filter(
      (item) => item.outputType === "FinancialModel" && item.validationStatus === "invalid",
    );

    expect(validFinancial.length).toBe(1);
    expect(invalidFinancial.length).toBe(0);
  });

  it("asserts truncation diagnostics metadata and repair token escalation deterministically", async () => {
    const store = new InMemoryArtifactStore();
    const providerManager = new ProviderManager();
    const financialMaxTokens: number[] = [];
    let financialCalls = 0;

    const context: AgentExecutionContext = {
      projectId: "proj-truncation-diagnostic",
      workflowRunId: "run-truncation-diagnostic",
      taskId: "task-truncation-diagnostic",
      projectContext: eggreenContext,
      currentDate: eggreenContext.currentDate,
      clock: {
        nowISO: () => "2026-07-28T00:00:00.000Z",
        nowMs: () => new Date("2026-07-28T00:00:00.000Z").getTime(),
      },
      upstreamArtifacts: {
        businessPlan: validBusinessPlan,
        marketResearchReport: validMarketResearchReport,
      },
      selectedProviderId: "truncate-test",
      providerModel: "truncate-model",
      outputTokenBudget: {
        initialOutputTokens: 3600,
        repairOutputTokens: 4200,
        maxOutputTokens: 5200,
      },
      attemptNumber: 1,
      repairAttemptNumber: 0,
      executionMode: "normal",
      trace: {
        pipelineId: "business_strategist_market_research",
        agentId: "financial_analyst",
        correlationId: "corr-trunc-meta",
      },
      persistence: {
        artifactStore: store,
      },
      providerManager,
      modelConfig: {
        provider: "truncate-test",
        model: "truncate-model",
        maxTokens: 3600,
      },
      declaredCapabilities: ["external_api"],
    };

    const result = await executeAgentLifecycle({
      definitionPrompt: "Generate FinancialModel JSON only.",
      outputContract: outputContracts.FinancialModel,
      executionContext: context,
      requiredCapabilities: ["external_api"],
      requiredProjectContextFields: [],
      supportedVerticals: ["any"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 1,
      maxProviderCalls: 2,
      getProvider: () => ({
        id: "truncate-test",
        invoke: async (_prompt, options) => {
          financialCalls += 1;
          financialMaxTokens.push(Number(options.maxTokens ?? 0));
          if (financialCalls === 1) {
            return {
              ...baseResult('{"verticalId":"restaurant_food_service"'),
              usage: { inputTokens: 100, outputTokens: 3000, totalTokens: 3100 },
              metadata: {
                ...baseResult("").metadata,
                parsedJson: false,
                rawResponseTruncated: true,
                truncatedDetected: true,
                finishReason: "max_output_tokens",
                responseStatus: "incomplete",
                parsingClassification: "truncated_json",
                parsingStage: "json_parse_failed",
                incompleteReason: "max_output_tokens",
                responseCharLength: 38,
                configuredMaxOutputTokens: Number(options.maxTokens ?? 3600),
              },
            };
          }

          return {
            ...baseResult(validFinancialModel),
            usage: { inputTokens: 120, outputTokens: 1800, totalTokens: 1920 },
            metadata: {
              ...baseResult(validFinancialModel).metadata,
              configuredMaxOutputTokens: Number(options.maxTokens ?? 4200),
            },
          };
        },
      }),
      model: "truncate-model",
      buildRepairPrompt: (issues) => `Repair with exact schema. Issues: ${issues.join("; ")}`,
    });

    expect(financialCalls).toBe(2);
    expect(financialMaxTokens.length).toBe(2);
    expect(financialMaxTokens[1]!).toBeGreaterThan(financialMaxTokens[0]!);

    expect(result.result.kind).toBe("success");
    expect(result.attempts.length).toBe(2);

    const firstAttempt = result.attempts[0] as {
      validationDiagnostic?: {
        parsingClassification?: string;
        validationStage?: string;
        finishReason?: string | null;
        incompleteReason?: string | null;
        responseStatus?: string | null;
        outputTokens?: number | null;
        configuredOutputTokenLimit?: number | null;
        incompleteResponse?: boolean;
      };
    };

    expect(firstAttempt.validationDiagnostic?.parsingClassification).toMatch(/truncated_json|incomplete_provider_response/);
    expect(firstAttempt.validationDiagnostic?.validationStage).toBe("json_parse");
    expect(firstAttempt.validationDiagnostic?.finishReason).toBe("max_output_tokens");
    expect(firstAttempt.validationDiagnostic?.incompleteReason).toBe("max_output_tokens");
    expect(firstAttempt.validationDiagnostic?.responseStatus).toBe("incomplete");
    expect(firstAttempt.validationDiagnostic?.outputTokens).toBe(3000);
    expect(firstAttempt.validationDiagnostic?.configuredOutputTokenLimit).toBe(financialMaxTokens[0]);
    expect(firstAttempt.validationDiagnostic?.incompleteResponse).toBe(true);

    const persistedArtifacts = await store.list("proj-truncation-diagnostic");
    const validFinancialArtifacts = persistedArtifacts.filter(
      (item) => item.outputType === "FinancialModel" && item.validationStatus === "valid",
    );
    const invalidFinancialArtifacts = persistedArtifacts.filter(
      (item) => item.outputType === "FinancialModel" && item.validationStatus === "invalid",
    );

    expect(validFinancialArtifacts.length).toBe(1);
    expect(invalidFinancialArtifacts.length).toBe(0);
  });
});
