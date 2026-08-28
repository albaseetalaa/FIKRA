import { describe, expect, it } from "vitest";
import { executeAgentLifecycle } from "../sdk/lifecycle";
import { outputContracts } from "../sdk/outputContractRegistry";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import type { AgentExecutionContext } from "../sdk/types";
import type { ProjectContext } from "../context";
import { createProjectContextFixture, getVerticalTemplate } from "../context";
import { ProviderManager } from "../providers/manager";
import type { BusinessPlan } from "../types/outputs";
import mocks from "./mocks";

// Regression coverage for system-owned BusinessPlan provider provenance: the
// live Eggreen regression succeeded but persisted modelProvider/modelName as
// null, because the prompt never tells the model what value belongs there
// and the model is never a trustworthy source for its own identity anyway.
// lifecycle.ts now overwrites both fields — and, per the follow-up
// audit, verticalTemplateVersion too — with the actual runtime
// selectedProviderId/providerModel/canonical-template-version from the
// execution context, after provider-response parsing and before
// structural/semantic validation, so the model's own claim (including
// null, missing, or a fabricated value) can never be observed, validated,
// or persisted.

const eggreenContext: ProjectContext = createProjectContextFixture({
  projectId: "proj_eggreen",
  businessName: "Eggreen",
  businessDescription: "Healthy breakfast restaurant",
  budgetRange: null,
  launchTimeline: "Within 3 months",
});

function makeContext(
  store: InMemoryArtifactStore,
  provenance: { selectedProviderId: string; providerModel: string },
  projectContext: ProjectContext = eggreenContext,
): AgentExecutionContext {
  return {
    projectId: "proj-lifecycle",
    workflowRunId: "run-lifecycle",
    taskId: "run-lifecycle:task-1",
    projectContext,
    currentDate: projectContext.currentDate,
    clock: {
      nowISO: () => "2026-07-28T00:00:00.000Z",
      nowMs: () => new Date("2026-07-28T00:00:00.000Z").getTime(),
    },
    upstreamArtifacts: {},
    selectedProviderId: provenance.selectedProviderId,
    providerModel: provenance.providerModel,
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
      provider: provenance.selectedProviderId,
      model: provenance.providerModel,
      maxTokens: 1500,
    },
    declaredCapabilities: ["external_api"],
  };
}

async function runBusinessStrategist(
  provenance: { selectedProviderId: string; providerModel: string },
  rawOutput: unknown,
  projectContext: ProjectContext = eggreenContext,
) {
  const store = new InMemoryArtifactStore();
  const execution = await executeAgentLifecycle({
    definitionPrompt: "prompt",
    outputContract: outputContracts.BusinessPlan,
    executionContext: makeContext(store, provenance, projectContext),
    requiredCapabilities: ["external_api"],
    requiredProjectContextFields: [],
    supportedVerticals: ["any"],
    persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
    maxTransportRetries: 1,
    maxRepairAttempts: 0,
    maxProviderCalls: 1,
    getProvider: () => ({
      id: provenance.selectedProviderId,
      invoke: async () => ({ output: rawOutput }),
    }),
    model: provenance.providerModel,
    buildRepairPrompt: (issues) => issues.join("\n"),
  });
  return execution;
}

describe("BusinessPlan provider provenance is system-owned", () => {
  it("records the real provider/model for an OpenAI execution", async () => {
    const rawOutput: BusinessPlan = { ...mocks.validBusinessPlan, modelProvider: null, modelName: null };
    const execution = await runBusinessStrategist(
      { selectedProviderId: "openai", providerModel: "gpt-4o-mini" },
      rawOutput,
    );

    expect(execution.result.kind).toBe("success");
    if (execution.result.kind === "success") {
      const output = execution.result.output as BusinessPlan;
      expect(output.modelProvider).toBe("openai");
      expect(output.modelName).toBe("gpt-4o-mini");
    }
  });

  it("records mock + its configured model for a mock test execution", async () => {
    const rawOutput: BusinessPlan = { ...mocks.validBusinessPlan, modelProvider: null, modelName: null };
    const execution = await runBusinessStrategist(
      { selectedProviderId: "mock", providerModel: "mock-model" },
      rawOutput,
    );

    expect(execution.result.kind).toBe("success");
    if (execution.result.kind === "success") {
      const output = execution.result.output as BusinessPlan;
      expect(output.modelProvider).toBe("mock");
      expect(output.modelName).toBe("mock-model");
    }
  });

  it("cannot be overridden or falsified by the model's own output", async () => {
    const spoofedOutput: BusinessPlan = {
      ...mocks.validBusinessPlan,
      modelProvider: "anthropic-fake",
      modelName: "claude-3-spoofed",
    };
    const execution = await runBusinessStrategist(
      { selectedProviderId: "openai", providerModel: "gpt-4o-mini" },
      spoofedOutput,
    );

    expect(execution.result.kind).toBe("success");
    if (execution.result.kind === "success") {
      const output = execution.result.output as BusinessPlan;
      expect(output.modelProvider).toBe("openai");
      expect(output.modelName).toBe("gpt-4o-mini");
      expect(output.modelProvider).not.toBe("anthropic-fake");
      expect(output.modelName).not.toBe("claude-3-spoofed");
    }
  });

  it("still passes full BusinessPlan validation (schema + semantics) with the injected provenance", async () => {
    const rawOutput: BusinessPlan = { ...mocks.validBusinessPlan, modelProvider: null, modelName: null };
    const execution = await runBusinessStrategist(
      { selectedProviderId: "openai", providerModel: "gpt-4o-mini" },
      rawOutput,
    );

    expect(execution.result.kind).toBe("success");
  });

  it("does not regress any other provenance or content field", async () => {
    const rawOutput: BusinessPlan = { ...mocks.validBusinessPlan, modelProvider: null, modelName: null };
    const execution = await runBusinessStrategist(
      { selectedProviderId: "openai", providerModel: "gpt-4o-mini" },
      rawOutput,
    );

    expect(execution.result.kind).toBe("success");
    if (execution.result.kind === "success") {
      const output = execution.result.output as BusinessPlan;
      const {
        modelProvider: _outputProvider,
        modelName: _outputModel,
        verticalTemplateVersion: _outputVersion,
        ...untouched
      } = output;
      const {
        modelProvider: _origProvider,
        modelName: _origModel,
        verticalTemplateVersion: _origVersion,
        ...expectedUntouched
      } = mocks.validBusinessPlan;
      expect(untouched).toEqual(expectedUntouched);
    }
  });
});

describe("BusinessPlan verticalTemplateVersion is system-owned and canonical", () => {
  it("(1) restaurant_food_service records its actual registry version", async () => {
    const expectedVersion = getVerticalTemplate("restaurant_food_service").version;
    const rawOutput: BusinessPlan = { ...mocks.validBusinessPlan, verticalTemplateVersion: "0.0.0-wrong" };
    const execution = await runBusinessStrategist(
      { selectedProviderId: "openai", providerModel: "gpt-4o-mini" },
      rawOutput,
    );

    expect(execution.result.kind).toBe("success");
    if (execution.result.kind === "success") {
      const output = execution.result.output as BusinessPlan;
      expect(output.verticalTemplateVersion).toBe(expectedVersion);
    }
  });

  it("(2) another vertical records its own registry version", async () => {
    const saasContext = createProjectContextFixture({
      businessName: "Eggreen",
      country: "Jordan",
      city: "Amman",
      currency: "JOD",
      businessStage: "planning",
      businessVertical: "saas_software",
      primaryRevenueModel: "subscription",
      revenueModelType: "subscription",
      salesChannels: ["website", "direct_sales"],
      revenueChannels: ["website", "direct_sales"],
      revenueComponents: ["monthly_subscription"],
    });
    const expectedVersion = getVerticalTemplate("saas_software").version;
    const saasBusinessPlan: BusinessPlan = {
      ...mocks.validBusinessPlan,
      businessVertical: "saas_software",
      primaryRevenueModel: "subscription",
      secondaryRevenueModels: [],
      salesChannels: ["website", "direct_sales"],
      revenueComponents: ["monthly_subscription"],
      verticalTemplateVersion: "0.0.0-wrong",
    };

    const execution = await runBusinessStrategist(
      { selectedProviderId: "openai", providerModel: "gpt-4o-mini" },
      saasBusinessPlan,
      saasContext,
    );

    expect(execution.result.kind).toBe("success");
    if (execution.result.kind === "success") {
      const output = execution.result.output as BusinessPlan;
      expect(output.verticalTemplateVersion).toBe(expectedVersion);
    }
  });

  it("(3) a model-supplied spoofed verticalTemplateVersion cannot survive", async () => {
    const expectedVersion = getVerticalTemplate("restaurant_food_service").version;
    const spoofedOutput: BusinessPlan = { ...mocks.validBusinessPlan, verticalTemplateVersion: "99.99.99-spoofed" };
    const execution = await runBusinessStrategist(
      { selectedProviderId: "openai", providerModel: "gpt-4o-mini" },
      spoofedOutput,
    );

    expect(execution.result.kind).toBe("success");
    if (execution.result.kind === "success") {
      const output = execution.result.output as BusinessPlan;
      expect(output.verticalTemplateVersion).toBe(expectedVersion);
      expect(output.verticalTemplateVersion).not.toBe("99.99.99-spoofed");
    }
  });

  it("(4) full BusinessPlan structural + semantic validation still passes with the injected version", async () => {
    const rawOutput: BusinessPlan = { ...mocks.validBusinessPlan, verticalTemplateVersion: null as unknown as string };
    const execution = await runBusinessStrategist(
      { selectedProviderId: "openai", providerModel: "gpt-4o-mini" },
      rawOutput,
    );

    expect(execution.result.kind).toBe("success");
  });

  it("(5) is sourced live from the vertical template registry, not hardcoded in lifecycle code — proven by comparing two different verticals' independently-computed registry versions to the persisted output, with no lifecycle.ts changes between them", async () => {
    for (const vertical of ["restaurant_food_service", "saas_software"] as const) {
      const expectedVersion = getVerticalTemplate(vertical).version;
      const context = createProjectContextFixture({
        businessName: "Eggreen",
        country: "Jordan",
        city: "Amman",
        currency: "JOD",
        businessStage: "planning",
        businessVertical: vertical,
        ...(vertical === "saas_software"
          ? {
              primaryRevenueModel: "subscription" as const,
              revenueModelType: "subscription" as const,
              salesChannels: ["website", "direct_sales"] as const,
              revenueChannels: ["website", "direct_sales"] as const,
              revenueComponents: ["monthly_subscription"] as const,
            }
          : {}),
      });
      const plan: BusinessPlan =
        vertical === "saas_software"
          ? {
              ...mocks.validBusinessPlan,
              businessVertical: "saas_software",
              primaryRevenueModel: "subscription",
              secondaryRevenueModels: [],
              salesChannels: ["website", "direct_sales"],
              revenueComponents: ["monthly_subscription"],
            }
          : mocks.validBusinessPlan;

      const execution = await runBusinessStrategist(
        { selectedProviderId: "openai", providerModel: "gpt-4o-mini" },
        plan,
        context,
      );

      expect(execution.result.kind).toBe("success");
      if (execution.result.kind === "success") {
        const output = execution.result.output as BusinessPlan;
        // Asserted against the registry's own live value (never a hardcoded
        // literal) — if a template's version is ever changed in the
        // registry, this proves the persisted output tracks it with zero
        // lifecycle.ts changes.
        expect(output.verticalTemplateVersion).toBe(expectedVersion);
      }
    }
  });
});
