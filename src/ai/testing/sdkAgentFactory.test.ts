import { describe, expect, it } from "vitest";
import { AgentFactory } from "../sdk/agentFactory";
import { OutputContractRegistry } from "../sdk/outputContractRegistry";
import { ProviderManager } from "../providers/manager";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import type AIProvider from "../providers/interface";
import { sdkAgentDefinitions } from "../agents/sdkDefinitions";
import type { AgentExecutionContext } from "../sdk/types";
import type { ProjectContext } from "../context";
import mocks from "./mocks";
import { outputContracts } from "../sdk/outputContractRegistry";

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

function createExecutionContext(store: InMemoryArtifactStore, providerManager: ProviderManager): AgentExecutionContext {
  return {
    projectId: "proj-factory",
    workflowRunId: "run-factory",
    taskId: "run-factory:task-1",
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
    providerManager,
    modelConfig: {
      provider: "mock-provider",
      model: "mock-model",
      maxTokens: 1500,
    },
    declaredCapabilities: ["external_api"],
  };
}

describe("AgentFactory", () => {
  it("validates startup definitions against output contracts", () => {
    const providerManager = new ProviderManager();
    const factory = new AgentFactory(
      { providerManager, artifactStore: new InMemoryArtifactStore() },
      new Map(),
    );

    expect(() => factory.validateAtStartup([sdkAgentDefinitions[0]!])).toThrow("startup validation failed");
  });

  it("executes an SDK agent with dependency-injected provider resolver", async () => {
    const providerManager = new ProviderManager();
    const store = new InMemoryArtifactStore();
    const registry = new OutputContractRegistry();
    const factory = new AgentFactory(
      { providerManager, artifactStore: store },
      new Map(registry.list().map((contract) => [contract.outputType, contract])),
    );

    const definition = sdkAgentDefinitions.find((item) => item.id === "business_strategist");
    expect(definition).toBeDefined();

    const mockProvider: AIProvider = {
      id: "mock-provider",
      name: "Mock Provider",
      async invoke() {
        return { output: mocks.validBusinessPlan };
      },
      async health() {
        return { ok: true };
      },
      async models() {
        return ["mock-model"];
      },
      async validateConfiguration() {
        return true;
      },
    };

    const executable = factory.build(definition!, {
      providerId: "mock-provider",
      model: "mock-model",
      getProvider: () => mockProvider,
    });

    const result = await executable.execute(createExecutionContext(store, providerManager), {});
    expect(result.kind).toBe("success");

    const artifacts = await store.list("proj-factory");
    expect(artifacts.length).toBe(1);
    expect(artifacts[0]?.outputType).toBe("BusinessPlan");
  });

  it("ensures enabled definitions resolve canonical output contracts", () => {
    const enabled = sdkAgentDefinitions.filter((item) => item.enabled);
    for (const definition of enabled) {
      const contract = outputContracts[definition.outputArtifactType];
      expect(contract).toBeDefined();
      expect(definition.outputArtifactType).toBe(contract.outputType);
      expect(definition.version).toBe(contract.version);
    }
  });

  it("delegates provider/schema/semantic validation to canonical contract", () => {
    const definition = sdkAgentDefinitions.find((item) => item.id === "business_strategist");
    expect(definition).toBeDefined();
    const contract = outputContracts[definition!.outputArtifactType];
    expect(contract).toBeDefined();

    const providerSpy = [] as string[];
    const originalProviderSchema = contract.providerSchema;
    contract.providerSchema = ((ctx: ProjectContext) => {
      providerSpy.push("provider");
      return originalProviderSchema(ctx);
    }) as typeof contract.providerSchema;

    const structuralSpy = [] as string[];
    const originalStructural = contract.structuralValidator;
    contract.structuralValidator = ((raw: unknown, ctx?: ProjectContext) => {
      structuralSpy.push("structural");
      return originalStructural(raw, ctx);
    }) as typeof contract.structuralValidator;

    const semanticSpy = [] as string[];
    const originalSemantic = contract.semanticValidator;
    contract.semanticValidator = ((raw: unknown, ctx?: ProjectContext) => {
      semanticSpy.push("semantic");
      return originalSemantic(raw, ctx);
    }) as typeof contract.semanticValidator;

    try {
      const ctx = createExecutionContext(new InMemoryArtifactStore(), new ProviderManager());
      definition!.providerSchema(ctx);
      definition!.structuralValidator(mocks.validBusinessPlan, ctx);
      definition!.semanticValidator(mocks.validBusinessPlan, ctx);

      expect(providerSpy.length).toBe(1);
      expect(structuralSpy.length).toBe(1);
      expect(semanticSpy.length).toBe(1);
    } finally {
      contract.providerSchema = originalProviderSchema;
      contract.structuralValidator = originalStructural;
      contract.semanticValidator = originalSemantic;
    }
  });

  it("rejects enabled incomplete agents at startup readiness validation", () => {
    const providerManager = new ProviderManager();
    const store = new InMemoryArtifactStore();
    const registry = new OutputContractRegistry();
    const factory = new AgentFactory(
      { providerManager, artifactStore: store },
      new Map(registry.list().map((contract) => [contract.outputType, contract])),
    );

    const base = sdkAgentDefinitions.find((item) => item.id === "business_strategist");
    const incomplete = {
      ...base!,
      enabled: true,
      tokenBudget: {
        initialOutputTokens: 0,
        repairOutputTokens: 0,
        maxOutputTokens: 0,
      },
    };

    expect(() => factory.validateAtStartup([incomplete])).toThrow("incomplete tokenBudget policy");
  });
});
