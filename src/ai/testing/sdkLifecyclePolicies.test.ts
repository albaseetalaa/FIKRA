import { describe, expect, it } from "vitest";
import { executeAgentLifecycle } from "../sdk/lifecycle";
import type { OutputContract, AgentExecutionContext } from "../sdk/types";
import { outputContracts } from "../sdk/outputContractRegistry";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import type { ProjectContext } from "../context";
import { ProviderManager } from "../providers/manager";
import mocks from "./mocks";

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

function makeContext(store: InMemoryArtifactStore, capabilities: AgentExecutionContext["declaredCapabilities"] = ["external_api"]): AgentExecutionContext {
  return {
    projectId: "proj-lifecycle-policy",
    workflowRunId: "run-lifecycle-policy",
    taskId: "run-lifecycle-policy:task-1",
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
    declaredCapabilities: capabilities,
  };
}

describe("sdk lifecycle policies", () => {
  it("rejects undeclared capabilities with typed metadata", async () => {
    const store = new InMemoryArtifactStore();
    const result = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      providerPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: makeContext(store, []),
      requiredCapabilities: ["external_api"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 1,
      maxProviderCalls: 1,
      getProvider: () => ({ id: "mock-provider", invoke: async () => ({ output: mocks.validBusinessPlan }) }),
      model: "mock-model",
      timeoutMs: 100,
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(result.result.kind).toBe("non_retryable_failure");
    expect(result.result.metadata).toMatchObject({ code: "CAPABILITY_DENIED" });
  });

  it("fails semantic validation when semantic validator reports issues", async () => {
    const store = new InMemoryArtifactStore();
    const semanticOnlyContract: OutputContract = {
      outputType: "ProjectSummary",
      version: "1.0.0",
      tsTypeName: "ProjectSummary",
      providerSchema: () => null,
      structuralValidator: (raw) => ({ success: true, value: raw }),
      semanticValidator: () => ["semantic mismatch"],
      promptRequirements: ["semantic test"],
      persistenceMetadata: {
        validationStatusOnSuccess: "valid",
        persistInvalidArtifacts: false,
        schemaVersion: 1,
        artifactVersion: 1,
      },
      migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
    };

    const result = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      providerPrompt: "prompt",
      outputContract: semanticOnlyContract,
      executionContext: makeContext(store),
      requiredCapabilities: ["external_api"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 0,
      maxProviderCalls: 1,
      getProvider: () => ({ id: "mock-provider", invoke: async () => ({ output: { ok: true } }) }),
      model: "mock-model",
      timeoutMs: 100,
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(result.result.kind).toBe("non_retryable_failure");
    if (result.result.kind !== "success") {
      expect(result.result.message).toContain("semantic");
    }
  });

  it("uses initial and repair token budgets across attempts", async () => {
    const store = new InMemoryArtifactStore();
    const capturedTokenLimits: number[] = [];
    const responses = [{ output: { invalid: true } }, { output: mocks.validBusinessPlan }];

    const result = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      providerPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: makeContext(store),
      requiredCapabilities: ["external_api"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 1,
      maxProviderCalls: 2,
      getProvider: () => ({
        id: "mock-provider",
        invoke: async (_prompt: string, options: { maxTokens?: number }) => {
          capturedTokenLimits.push(options.maxTokens ?? 0);
          return responses.shift() ?? { output: mocks.validBusinessPlan };
        },
      }),
      model: "mock-model",
      timeoutMs: 100,
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(result.result.kind).toBe("success");
    expect(capturedTokenLimits).toEqual([1500, 2100]);
  });

  it("returns non-retryable failure when repair attempts are exhausted", async () => {
    const store = new InMemoryArtifactStore();
    const result = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      providerPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: makeContext(store),
      requiredCapabilities: ["external_api"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 1,
      maxProviderCalls: 2,
      getProvider: () => ({ id: "mock-provider", invoke: async () => ({ output: { invalid: true } }) }),
      model: "mock-model",
      timeoutMs: 100,
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(result.result.kind).toBe("non_retryable_failure");
  });

  it("returns failure when provider throws", async () => {
    const store = new InMemoryArtifactStore();
    const result = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      providerPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: makeContext(store),
      requiredCapabilities: ["external_api"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 1,
      maxProviderCalls: 1,
      getProvider: () => ({ id: "mock-provider", invoke: async () => { throw new Error("provider down"); } }),
      model: "mock-model",
      timeoutMs: 100,
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(result.result.kind).toBe("non_retryable_failure");
  });

  it("supports timeout behavior", async () => {
    const store = new InMemoryArtifactStore();
    const result = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      providerPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: makeContext(store),
      requiredCapabilities: ["external_api"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 0,
      maxProviderCalls: 1,
      getProvider: () => ({ id: "mock-provider", invoke: async () => new Promise(() => {}) }),
      model: "mock-model",
      timeoutMs: 10,
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(result.result.kind).toBe("non_retryable_failure");
    if (result.result.kind !== "success") {
      expect(result.result.message.toLowerCase()).toContain("timed out");
    }
  });

  it("supports cancellation behavior", async () => {
    const store = new InMemoryArtifactStore();
    const controller = new AbortController();
    controller.abort();
    const ctx = makeContext(store);
    ctx.cancellationSignal = controller.signal;

    const result = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      providerPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: ctx,
      requiredCapabilities: ["external_api"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 1,
      maxProviderCalls: 2,
      getProvider: () => ({ id: "mock-provider", invoke: async () => ({ output: mocks.validBusinessPlan }) }),
      model: "mock-model",
      timeoutMs: 100,
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(result.result.kind).toBe("cancelled");
  });
});
