import { describe, expect, it } from "vitest";
import Orchestrator from "../orchestrator";
import pipelines from "../pipelines/pipelines";
import agents from "../agents/definitions";
import defaultModels from "../providers/models";
import { globalProviderManager } from "../providers/manager";
import type AIProvider from "../providers/interface";
import { validBusinessPlan, validFinancialModel, validMarketResearchReport } from "./mocks";

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
    let financialCalls = 0;

    const provider: AIProvider = {
      id: "truncate-test",
      name: "truncate-test",
      async invoke(_prompt, options) {
        if (options?.agentId === "business_strategist") return baseResult(validBusinessPlan);
        if (options?.agentId === "market_research") return baseResult(validMarketResearchReport);
        if (options?.agentId === "financial_analyst") {
          financialCalls += 1;
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
      { projectIdea: "Eggreen healthy breakfast in Amman" },
      "run-fin-trunc-repair",
    );

    const fin = tasks.find((task) => task.step.agent === "financial_analyst");
    expect(fin?.status).toBe("completed");
    expect(fin?.attempts.length).toBe(2);
    expect(fin?.attempts[0]?.validationDiagnostic?.parsingClassification).toBe("truncated_json");
    expect(financialCalls).toBe(2);
  });
});
