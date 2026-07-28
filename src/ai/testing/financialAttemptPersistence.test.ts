import { afterEach, describe, expect, it } from "vitest";
import { createProject, getProjectStatus, startBusinessStrategistExecution } from "../../lib/project-workflow/service";
import { globalProviderManager } from "../providers/manager";
import type AIProvider from "../providers/interface";
import { validBusinessPlan, validFinancialModel, validMarketResearchReport } from "./mocks";
import { getPersistenceContainer, resetPersistenceContainerForTests } from "../../lib/persistence/setup";
import type { WorkflowTaskRecord } from "../../lib/persistence/types";
import defaultModels from "../providers/models";

function baseResult(output: unknown) {
  return {
    providerId: "openai",
    model: "attempt-model",
    requestId: "req-attempt",
    output,
    usage: { inputTokens: 50, outputTokens: 120, totalTokens: 170 },
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
      parsingClassification: typeof output === "string" ? "malformed_json" : "native_structured_object",
      parsingStage: typeof output === "string" ? "json_parse_failed" : "provider_native_parsed",
      incompleteReason: null,
      responseCharLength: typeof output === "string" ? output.length : 0,
      configuredMaxOutputTokens: 3600,
    },
  };
}

async function waitForTerminal(projectId: string) {
  for (let i = 0; i < 60; i += 1) {
    const status = await getProjectStatus(projectId);
    if (!status) return null;
    if (status.status === "completed" || status.status === "failed") return status;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return getProjectStatus(projectId);
}

describe("financial attempt persistence", () => {
  afterEach(() => {
    globalProviderManager.clear();
    resetPersistenceContainerForTests();
  });

  it("persists unique FinancialModel attempt numbers across generation plus two repairs", async () => {
    let financialCalls = 0;
    const provider: AIProvider = {
      id: "openai",
      name: "attempt-test",
      async invoke(_prompt, options) {
        if (options?.agentId === "business_strategist") return baseResult(validBusinessPlan);
        if (options?.agentId === "market_research") return baseResult(validMarketResearchReport);
        if (options?.agentId === "financial_analyst") {
          financialCalls += 1;
          if (financialCalls <= 2) {
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
        return ["attempt-model"];
      },
      async validateConfiguration() {
        return true;
      },
    };

    globalProviderManager.clear();

    const configuredProviderIds = new Set<string>([
      defaultModels.business_strategist.provider,
      defaultModels.market_research.provider,
      defaultModels.financial_analyst.provider,
      "openai",
      "structured-stub",
      "mock",
    ]);

    for (const providerId of configuredProviderIds) {
      globalProviderManager.register({
        ...provider,
        id: providerId,
        name: `attempt-test-${providerId}`,
      });
    }

    const created = await createProject({
      idea: "Eggreen healthy breakfast restaurant in Amman",
      businessName: "Eggreen",
      industry: "Restaurant & Food",
      country: "Jordan",
      city: "Amman",
      stage: "Planning",
      audience: "Young professionals",
      ageRange: "18-45",
      customerType: "Individuals",
      goals: ["Build financial model"],
      budget: "50000-80000",
      timeline: "3 months",
      currency: "JOD",
    });

    await startBusinessStrategistExecution(created.projectId);
    const terminal = await waitForTerminal(created.projectId);
    expect(terminal?.status).toBe("completed");

    const repos = getPersistenceContainer();
    const run = await repos.workflowRuns.listByProject(created.projectId);
    expect(run.length).toBeGreaterThan(0);
    const latestRun = run[0];
    expect(latestRun).toBeTruthy();

    const tasks = await repos.workflowTasks.listByRun(latestRun!.id);
    expect(latestRun?.status).toBe("completed");

    const strategistTask = tasks.find((task: WorkflowTaskRecord) => task.agentId === "business_strategist");
    const marketTask = tasks.find((task: WorkflowTaskRecord) => task.agentId === "market_research");
    const financialTask = tasks.find((task: WorkflowTaskRecord) => task.agentId === "financial_analyst");

    expect(strategistTask?.status).toBe("completed");
    expect(marketTask?.status).toBe("completed");
    expect(financialTask?.status).toBe("completed");
    expect(financialCalls).toBe(3);

    expect(financialTask).toBeTruthy();

    const attempts = await repos.attempts.listByTask(financialTask!.id);
    const attemptNumbers = attempts.map((attempt) => attempt.attemptNumber).sort((a, b) => a - b);
    if (attemptNumbers.length > 0) {
      expect(new Set(attemptNumbers).size).toBe(attemptNumbers.length);
      const sortedAttempts = attempts
        .slice()
        .sort((left, right) => left.attemptNumber - right.attemptNumber);
      expect(sortedAttempts[sortedAttempts.length - 1]?.status).toBe("completed");
    }

    const artifacts = await repos.artifacts.list(created.projectId);
    const artifactTypes = artifacts.filter((item) => item.validationStatus === "valid").map((item) => item.outputType);

    expect(artifactTypes.filter((type) => type === "BusinessPlan").length).toBe(1);
    expect(artifactTypes.filter((type) => type === "MarketResearchReport").length).toBe(1);
    expect(artifactTypes.filter((type) => type === "FinancialModel").length).toBe(1);
    expect(artifactTypes.filter((type) => type === "ProjectScore").length).toBe(1);

    const financialModelArtifacts = artifacts.filter(
      (item) => item.outputType === "FinancialModel" && item.validationStatus === "valid",
    );
    expect(financialModelArtifacts.length).toBe(1);

    const perAgentTaskCount = tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.agentId] = (acc[task.agentId] ?? 0) + 1;
      return acc;
    }, {});
    expect(perAgentTaskCount.business_strategist ?? 0).toBe(1);
    expect(perAgentTaskCount.market_research ?? 0).toBe(1);
    expect(perAgentTaskCount.financial_analyst ?? 0).toBe(1);
  });
});
