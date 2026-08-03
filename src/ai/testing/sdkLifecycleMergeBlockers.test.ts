import { describe, expect, it } from "vitest";
import { executeAgentLifecycle } from "../sdk/lifecycle";
import type { AgentDefinition, AgentExecutionContext } from "../sdk/types";
import { outputContracts, OutputContractRegistry } from "../sdk/outputContractRegistry";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import type { ProjectContext } from "../context";
import { createProjectContextFixture } from "../context";
import { ProviderManager } from "../providers/manager";
import mocks from "./mocks";
import { AgentFactory } from "../sdk/agentFactory";
import { sdkAgentDefinitions } from "../agents/sdkDefinitions";
import { createAgentDefinitionTemplate } from "../sdk/templates/agentDefinition.template";
import { outputContractTemplate } from "../sdk/templates/outputContract.template";
import { AgentRegistry } from "../sdk/agentRegistry";

const eggreenContext: ProjectContext = createProjectContextFixture({
  projectId: "proj_eggreen",
  businessName: "Eggreen",
  businessDescription: "Healthy breakfast restaurant",
});

function makeContext(store: InMemoryArtifactStore): AgentExecutionContext {
  return {
    projectId: "proj-lifecycle-blockers",
    workflowRunId: "run-lifecycle-blockers",
    taskId: "run-lifecycle-blockers:task-1",
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

describe("sdk lifecycle merge blockers", () => {
  it("rejects missing requiredProjectContextFields", async () => {
    const store = new InMemoryArtifactStore();
    const ctx = makeContext(store);
    ctx.projectContext = { ...ctx.projectContext, city: null };

    const result = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: ctx,
      requiredCapabilities: ["external_api"],
      requiredProjectContextFields: ["city"],
      supportedVerticals: ["any"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 0,
      maxProviderCalls: 1,
      getProvider: () => ({ id: "mock-provider", invoke: async () => ({ output: mocks.validBusinessPlan }) }),
      model: "mock-model",
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(result.result.kind).toBe("non_retryable_failure");
    if (result.result.kind !== "success") {
      expect(result.result.message).toContain("Missing required ProjectContext field 'city'");
    }
  });

  it("rejects unsupported supportedVerticals", async () => {
    const store = new InMemoryArtifactStore();
    const result = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: makeContext(store),
      requiredCapabilities: ["external_api"],
      requiredProjectContextFields: [],
      supportedVerticals: ["saas_software"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 0,
      maxProviderCalls: 1,
      getProvider: () => ({ id: "mock-provider", invoke: async () => ({ output: mocks.validBusinessPlan }) }),
      model: "mock-model",
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(result.result.kind).toBe("non_retryable_failure");
    if (result.result.kind !== "success") {
      expect(result.result.message).toContain("Unsupported business vertical");
    }
  });

  it("enforces persistencePolicy for invalid attempts", async () => {
    const store = new InMemoryArtifactStore();
    const result = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: makeContext(store),
      requiredCapabilities: ["external_api"],
      requiredProjectContextFields: [],
      supportedVerticals: ["any"],
      persistencePolicy: { persistInvalidAttempts: false, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 0,
      maxProviderCalls: 1,
      getProvider: () => ({ id: "mock-provider", invoke: async () => ({ output: { invalid: true } }) }),
      model: "mock-model",
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(result.result.kind).toBe("non_retryable_failure");
    expect(result.attempts.length).toBe(0);
  });

  it("persists exactly one valid artifact on success", async () => {
    const store = new InMemoryArtifactStore();
    const result = await executeAgentLifecycle({
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
      getProvider: () => ({ id: "mock-provider", invoke: async () => ({ output: mocks.validBusinessPlan }) }),
      model: "mock-model",
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(result.result.kind).toBe("success");
    const artifacts = await store.list("proj-lifecycle-blockers");
    expect(artifacts.filter((item) => item.outputType === "BusinessPlan" && item.validationStatus === "valid").length).toBe(1);
  });

  it("supports cancellation while provider invocation is in progress", async () => {
    const store = new InMemoryArtifactStore();
    const controller = new AbortController();
    const ctx = makeContext(store);
    ctx.cancellationSignal = controller.signal;

    let invokeStarted = false;
    const resultPromise = executeAgentLifecycle({
      definitionPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: ctx,
      requiredCapabilities: ["external_api"],
      requiredProjectContextFields: [],
      supportedVerticals: ["any"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 0,
      maxProviderCalls: 1,
      getProvider: () => ({
        id: "mock-provider",
        invoke: async () => {
          invokeStarted = true;
          return new Promise(() => {});
        },
      }),
      model: "mock-model",
      timeoutMs: 1000,
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    setTimeout(() => controller.abort(), 5);
    const result = await resultPromise;

    expect(invokeStarted).toBe(true);
    expect(result.result.kind).toBe("cancelled");
  });

  it("cleans up timeout and cancellation listeners", async () => {
    const store = new InMemoryArtifactStore();
    const controller = new AbortController();
    const signal = controller.signal as AbortSignal & {
      addEventListener: AbortSignal["addEventListener"];
      removeEventListener: AbortSignal["removeEventListener"];
    };

    let addCount = 0;
    let removeCount = 0;
    const addOrig = signal.addEventListener.bind(signal);
    const removeOrig = signal.removeEventListener.bind(signal);

    signal.addEventListener = ((...args: Parameters<AbortSignal["addEventListener"]>) => {
      addCount += 1;
      return addOrig(...args);
    }) as AbortSignal["addEventListener"];

    signal.removeEventListener = ((...args: Parameters<AbortSignal["removeEventListener"]>) => {
      removeCount += 1;
      return removeOrig(...args);
    }) as AbortSignal["removeEventListener"];

    const ctx = makeContext(store);
    ctx.cancellationSignal = signal;

    const result = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: ctx,
      requiredCapabilities: ["external_api"],
      requiredProjectContextFields: [],
      supportedVerticals: ["any"],
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
    expect(addCount).toBeGreaterThan(0);
    expect(removeCount).toBe(addCount);
  });

  it("executes lifecycle hooks in order including prepareInput", async () => {
    const events: string[] = [];
    const providerManager = new ProviderManager();
    const store = new InMemoryArtifactStore();
    const registry = new OutputContractRegistry();
    const factory = new AgentFactory(
      { providerManager, artifactStore: store },
      new Map(registry.list().map((contract) => [contract.outputType, contract])),
    );

    const base = sdkAgentDefinitions.find((item) => item.id === "business_strategist");
    const definition: AgentDefinition = {
      ...base!,
      lifecycleHooks: {
        prepareInput: (_ctx, rawInput) => {
          events.push("prepareInput");
          return rawInput;
        },
        beforeExecute: () => {
          events.push("beforeExecute");
        },
        afterExecute: () => {
          events.push("afterExecute");
        },
        beforePersist: () => {
          events.push("beforePersist");
        },
        afterPersist: () => {
          events.push("afterPersist");
        },
      },
    };

    const executable = factory.build(definition, {
      providerId: "mock-provider",
      model: "mock-model",
      getProvider: () => ({
        id: "mock-provider",
        name: "mock-provider",
        invoke: async () => ({ output: mocks.validBusinessPlan }),
        health: async () => ({ ok: true }),
        models: async () => ["mock-model"],
        validateConfiguration: async () => true,
      }),
    });

    const result = await executable.execute(makeContext(store), { projectIdea: "x" });
    expect(result.kind).toBe("success");
    expect(events).toEqual(["prepareInput", "beforeExecute", "afterExecute", "beforePersist", "afterPersist"]);
  });

  it("surfaces lifecycle hook failure behavior", async () => {
    const providerManager = new ProviderManager();
    const store = new InMemoryArtifactStore();
    const registry = new OutputContractRegistry();
    const factory = new AgentFactory(
      { providerManager, artifactStore: store },
      new Map(registry.list().map((contract) => [contract.outputType, contract])),
    );

    const base = sdkAgentDefinitions.find((item) => item.id === "business_strategist");
    const definition: AgentDefinition = {
      ...base!,
      lifecycleHooks: {
        beforePersist: () => {
          throw new Error("persist hook failed");
        },
      },
    };

    const executable = factory.build(definition, {
      providerId: "mock-provider",
      model: "mock-model",
      getProvider: () => ({
        id: "mock-provider",
        name: "mock-provider",
        invoke: async () => ({ output: mocks.validBusinessPlan }),
        health: async () => ({ ok: true }),
        models: async () => ["mock-model"],
        validateConfiguration: async () => true,
      }),
    });

    await expect(executable.execute(makeContext(store), {})).rejects.toThrow("persist hook failed");
  });

  it("keeps templates fail-closed", () => {
    const definitionTemplate = createAgentDefinitionTemplate({
      id: "business_strategist",
      outputArtifactType: "ProjectSummary",
      displayName: "Template",
      category: "strategy",
    });
    const definitionValidation = definitionTemplate.structuralValidator({}, makeContext(new InMemoryArtifactStore()));

    expect(definitionTemplate.enabled).toBe(false);
    expect(definitionTemplate.selectableByDefault).toBe(false);
    expect(definitionValidation.success).toBe(false);

    const contractValidation = outputContractTemplate.structuralValidator({});
    expect(contractValidation.success).toBe(false);
    expect(outputContractTemplate.allowsPassThroughStructuralValidation).toBe(false);
  });

  it("accepts missing optional dependencies in registry validation", () => {
    const registry = new AgentRegistry();
    registry.register({
      ...sdkAgentDefinitions.find((item) => item.id === "business_strategist")!,
      optionalDependencies: ["market_research"],
      dependencies: [],
    });

    const result = registry.validateDependencies();
    expect(result.ok).toBe(true);
  });
});
