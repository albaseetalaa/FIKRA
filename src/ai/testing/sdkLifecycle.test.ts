import { describe, expect, it } from "vitest";
import { executeAgentLifecycle } from "../sdk/lifecycle";
import { outputContracts } from "../sdk/outputContractRegistry";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import type { AgentExecutionContext } from "../sdk/types";
import type { ProjectContext } from "../context";
import { createProjectContextFixture } from "../context";
import { ProviderManager } from "../providers/manager";
import mocks from "./mocks";

const eggreenContext: ProjectContext = createProjectContextFixture({
  projectId: "proj_eggreen",
  businessName: "Eggreen",
  businessDescription: "Healthy breakfast restaurant",
  budgetRange: null,
  launchTimeline: "Within 3 months",
});

function makeContext(store: InMemoryArtifactStore): AgentExecutionContext {
  return {
    projectId: "proj-lifecycle",
    workflowRunId: "run-lifecycle",
    taskId: "run-lifecycle:task-1",
    projectContext: eggreenContext,
    currentDate: eggreenContext.currentDate,
    clock: {
      nowISO: () => "2026-07-28T00:00:00.000Z",
      nowMs: () => new Date("2026-07-28T00:00:00.000Z").getTime(),
    },
    upstreamArtifacts: {},
    selectedProviderId: "mock-provider",
    providerModel: "mock-model",
    outputTokenBudget: {
      initialOutputTokens: 1500,
      repairOutputTokens: 2100,
      maxOutputTokens: 2600,
    },
    attemptNumber: 1,
    repairAttemptNumber: 0,
    executionMode: "normal",
    trace: {
      pipelineId: "pipe-1",
      agentId: "business_strategist",
      correlationId: "corr-1",
    },
    persistence: {
      artifactStore: store,
    },
    providerManager: new ProviderManager(),
    modelConfig: {
      provider: "mock-provider",
      model: "mock-model",
      maxTokens: 1500,
    },
    declaredCapabilities: ["external_api"],
  };
}

describe("sdk lifecycle", () => {
  it("persists successful output with attempt metadata", async () => {
    const store = new InMemoryArtifactStore();
    const execution = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: makeContext(store),
      requiredCapabilities: ["external_api"],
      requiredProjectContextFields: [],
      supportedVerticals: ["any"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 1,
      maxProviderCalls: 2,
      getProvider: () => ({
        id: "mock-provider",
        invoke: async () => ({ output: mocks.validBusinessPlan }),
      }),
      model: "mock-model",
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(execution.result.kind).toBe("success");
    expect(execution.attempts.length).toBe(1);
    const attempt = execution.attempts[0] as { timestamp?: string; rawOutput?: unknown };
    expect(typeof attempt.timestamp).toBe("string");
    expect(attempt.rawOutput).toBeDefined();

    const artifacts = await store.list("proj-lifecycle");
    expect(artifacts.length).toBe(1);
    expect(artifacts[0]?.outputType).toBe("BusinessPlan");
  });

  it("returns non-retryable failure when schema does not validate", async () => {
    const store = new InMemoryArtifactStore();
    const execution = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: makeContext(store),
      requiredCapabilities: ["external_api"],
      requiredProjectContextFields: [],
      supportedVerticals: ["any"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 0,
      maxProviderCalls: 1,
      getProvider: () => ({
        id: "mock-provider",
        invoke: async () => ({ output: { invalid: true } }),
      }),
      model: "mock-model",
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(execution.result.kind).toBe("non_retryable_failure");
    expect(execution.attempts.length).toBe(1);
    const firstAttempt = execution.attempts[0] as { validation?: { success?: boolean } };
    expect(firstAttempt.validation?.success).toBe(false);

    const artifacts = await store.list("proj-lifecycle");
    expect(artifacts.length).toBe(0);
  });
});
