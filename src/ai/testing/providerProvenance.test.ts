import { describe, expect, it } from "vitest";
import { executeAgentLifecycle } from "../sdk/lifecycle";
import { outputContracts } from "../sdk/outputContractRegistry";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import type { AgentExecutionContext } from "../sdk/types";
import type { ProjectContext } from "../context";
import { createProjectContextFixture } from "../context";
import { ProviderManager } from "../providers/manager";
import type { BusinessPlan } from "../types/outputs";
import mocks from "./mocks";

// Regression coverage for system-owned BusinessPlan provider provenance: the
// live Eggreen regression succeeded but persisted modelProvider/modelName as
// null, because the prompt never tells the model what value belongs there
// and the model is never a trustworthy source for its own identity anyway.
// lifecycle.ts now overwrites both fields with the actual runtime
// selectedProviderId/providerModel from the execution context, after
// provider-response parsing and before structural/semantic validation, so
// the model's own claim (including null, missing, or a fabricated value)
// can never be observed, validated, or persisted.

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
): AgentExecutionContext {
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
) {
  const store = new InMemoryArtifactStore();
  const execution = await executeAgentLifecycle({
    definitionPrompt: "prompt",
    outputContract: outputContracts.BusinessPlan,
    executionContext: makeContext(store, provenance),
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
      const { modelProvider: _outputProvider, modelName: _outputModel, ...untouched } = output;
      const { modelProvider: _origProvider, modelName: _origModel, ...expectedUntouched } = mocks.validBusinessPlan;
      expect(untouched).toEqual(expectedUntouched);
    }
  });
});
