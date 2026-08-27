import { describe, expect, it } from "vitest";
import { validateModel, validateModelStructure } from "../validation/validator";
import { validateBusinessPlanSemantics } from "../validation/semanticValidators";
import { outputContracts } from "../sdk/outputContractRegistry";
import { executeAgentLifecycle } from "../sdk/lifecycle";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import type { AgentExecutionContext } from "../sdk/types";
import type { ProjectContext } from "../context";
import { createProjectContextFixture } from "../context";
import { ProviderManager } from "../providers/manager";
import type { BusinessPlan, OutputModelName } from "../types/outputs";
import mocks from "./mocks";

// Regression coverage for the validation-stage-separation bug: a BusinessPlan
// that is structurally valid (matches BusinessPlanSchema) but semantically
// invalid (e.g. a revenue model incompatible with its declared vertical) was
// previously classified as a *schema* failure end to end, because the SDK's
// structural stage called validateModel() — which itself runs semantic
// checks — instead of a schema-only function. That produced the misleading
// "Output did not match expected schema" message for what is really a
// semantic problem (the real Eggreen Preview symptom on the BusinessPlan
// step). These tests prove the two stages are now cleanly separated.

// Deliberately structurally valid, semantically invalid: primaryRevenueModel
// "subscription" is a real RevenueModel value (used by saas_software), but is
// not in restaurant_food_service's applicableRevenueModels
// ["transaction_sales", "service_fees", "mixed"]. All required fields/types
// are preserved from the canonical fixture.
const structurallyValidSemanticallyInvalidBusinessPlan: BusinessPlan = {
  ...mocks.validBusinessPlan,
  primaryRevenueModel: "subscription",
};

const eggreenContext: ProjectContext = createProjectContextFixture({
  projectId: "proj_eggreen",
  businessName: "Eggreen",
  businessDescription: "Healthy breakfast restaurant",
  budgetRange: null,
  launchTimeline: "Within 3 months",
});

describe("validateModelStructure", () => {
  it("accepts a structurally valid BusinessPlan", () => {
    const r = validateModelStructure("BusinessPlan", mocks.validBusinessPlan);
    expect(r.success).toBe(true);
  });

  it("rejects a structurally invalid BusinessPlan", () => {
    const r = validateModelStructure("BusinessPlan", mocks.invalidBusinessPlan);
    expect(r.success).toBe(false);
  });

  it("preserves the existing 'Unknown model' error for an unrecognized model name", () => {
    const r = validateModelStructure("NotARealModel" as OutputModelName, {});
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors[0]?.message).toBe("Unknown model: NotARealModel");
    }
  });

  it("(A) returns success=true for a BusinessPlan that is structurally valid but semantically invalid", () => {
    const r = validateModelStructure("BusinessPlan", structurallyValidSemanticallyInvalidBusinessPlan);
    expect(r.success).toBe(true);
  });

  it("runs no stale-milestone/business-logic check — a stale milestone still passes structural validation", () => {
    const staleMilestonePlan = {
      ...mocks.validBusinessPlan,
      milestones: [
        {
          ...mocks.validBusinessPlan.milestones[0]!,
          targetDate: "2024-01-01",
          dateSource: "calculated_from_timeline" as const,
        },
      ],
    };

    // Sanity check: the full validateModel() still rejects this via its
    // stale-milestone business-logic check.
    expect(validateModel("BusinessPlan", staleMilestonePlan).success).toBe(false);

    const r = validateModelStructure("BusinessPlan", staleMilestonePlan);
    expect(r.success).toBe(true);
  });

  it("runs no FinancialModel semantic rules — forbidden-signal data still passes structural validation", () => {
    const invalid = {
      ...mocks.validFinancialModel,
      revenueDrivers: [...mocks.validFinancialModel.revenueDrivers, "mrr"],
    };

    // Sanity check: the full validateModel() still rejects this semantically.
    expect(
      validateModel("FinancialModel", invalid, {
        projectContext: eggreenContext,
      }).success,
    ).toBe(false);

    const r = validateModelStructure("FinancialModel", invalid);
    expect(r.success).toBe(true);
  });

  it("runs no MarketResearchReport semantic rules — a missing-methodology claim still passes structural validation", () => {
    const invalid = {
      ...mocks.validMarketResearchReport,
      claims: [{ ...mocks.validMarketResearchReport.claims[0]!, methodology: "" }],
    };

    // Sanity check: the full validateModel() still rejects this semantically.
    expect(validateModel("MarketResearchReport", invalid).success).toBe(false);

    const r = validateModelStructure("MarketResearchReport", invalid);
    expect(r.success).toBe(true);
  });
});

describe("validateModel (unchanged full validation entry point)", () => {
  it("still performs schema + BusinessPlan semantic validation together", () => {
    expect(validateModel("BusinessPlan", mocks.validBusinessPlan).success).toBe(true);
    expect(validateModel("BusinessPlan", mocks.invalidBusinessPlan).success).toBe(false);
  });

  it("(C) still returns success=false for a BusinessPlan that is structurally valid but semantically invalid", () => {
    const r = validateModel("BusinessPlan", structurallyValidSemanticallyInvalidBusinessPlan, {
      projectContext: eggreenContext,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.errors.some((issue) => issue.message.includes("primary revenue model incompatible with vertical")),
      ).toBe(true);
    }
  });
});

describe("(B) BusinessPlan semanticValidator", () => {
  it("returns one or more semantic issues for a structurally valid but vertical-incompatible plan", () => {
    const issues = validateBusinessPlanSemantics(
      structurallyValidSemanticallyInvalidBusinessPlan,
      eggreenContext,
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.includes("primary revenue model incompatible with vertical"))).toBe(true);
  });

  it("the BusinessPlan output contract's semanticValidator also flags it", () => {
    const issues = outputContracts.BusinessPlan.semanticValidator(
      structurallyValidSemanticallyInvalidBusinessPlan,
      eggreenContext,
    );
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("OutputContractRegistry structural/semantic stage separation", () => {
  it("BusinessPlan structuralValidator succeeds while semanticValidator reports issues for the same input", () => {
    const structural = outputContracts.BusinessPlan.structuralValidator(
      structurallyValidSemanticallyInvalidBusinessPlan,
      eggreenContext,
    );
    expect(structural.success).toBe(true);

    const semanticIssues = outputContracts.BusinessPlan.semanticValidator(
      structurallyValidSemanticallyInvalidBusinessPlan,
      eggreenContext,
    );
    expect(semanticIssues.length).toBeGreaterThan(0);
  });
});

function makeLifecycleContext(store: InMemoryArtifactStore): AgentExecutionContext {
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

describe("(D) sdk lifecycle classification — the real Eggreen symptom", () => {
  it('classifies a structurally valid but semantically invalid BusinessPlan as "Output failed semantic validation", not a schema failure', async () => {
    const store = new InMemoryArtifactStore();
    const execution = await executeAgentLifecycle({
      definitionPrompt: "prompt",
      outputContract: outputContracts.BusinessPlan,
      executionContext: makeLifecycleContext(store),
      requiredCapabilities: ["external_api"],
      requiredProjectContextFields: [],
      supportedVerticals: ["any"],
      persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
      maxTransportRetries: 1,
      maxRepairAttempts: 0,
      maxProviderCalls: 1,
      getProvider: () => ({
        id: "mock-provider",
        invoke: async () => ({ output: structurallyValidSemanticallyInvalidBusinessPlan }),
      }),
      model: "mock-model",
      buildRepairPrompt: (issues) => issues.join("\n"),
    });

    expect(execution.result.kind).toBe("non_retryable_failure");
    if (execution.result.kind !== "success") {
      expect(execution.result.message).toBe("Output failed semantic validation");
      expect(execution.result.message).not.toBe("Output did not match expected schema");
      expect(
        execution.result.issues?.some((issue) => issue.includes("primary revenue model incompatible with vertical")),
      ).toBe(true);
    }

    const artifacts = await store.list("proj-lifecycle");
    expect(artifacts.length).toBe(0);
  });
});
