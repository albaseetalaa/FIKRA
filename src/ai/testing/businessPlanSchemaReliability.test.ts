import { describe, expect, it } from "vitest";
import { validateModel } from "../validation/validator";
import { validBusinessPlan } from "./mocks";
import { buildAgentPrompt } from "../prompts/agentPromptBuilder";
import { normalizeProjectContext } from "../context";
import { BUSINESS_PLAN_REQUIRED_FIELDS, BUSINESS_PLAN_SYSTEM_OWNED_FIELDS } from "../contracts/outputContracts";

describe("BusinessPlan schema reliability", () => {
  it("rejects malformed JSON payload", () => {
    const result = validateModel("BusinessPlan", "{not:json}");
    expect(result.success).toBe(false);
  });

  it("rejects missing required field", () => {
    const invalid = { ...validBusinessPlan } as Record<string, unknown>;
    delete invalid.executiveSummary;
    const result = validateModel("BusinessPlan", invalid);
    expect(result.success).toBe(false);
  });

  it("rejects incorrect enum value", () => {
    const invalid = {
      ...validBusinessPlan,
      milestones: [
        {
          ...validBusinessPlan.milestones[0]!,
          dateSource: "invalid_source",
        },
      ],
    };
    const result = validateModel("BusinessPlan", invalid);
    expect(result.success).toBe(false);
  });

  it("rejects incorrect field type", () => {
    const invalid = {
      ...validBusinessPlan,
      customerSegments: "not-an-array",
    };
    const result = validateModel("BusinessPlan", invalid);
    expect(result.success).toBe(false);
  });

  // Derives its expectations from BUSINESS_PLAN_REQUIRED_FIELDS /
  // BUSINESS_PLAN_SYSTEM_OWNED_FIELDS (contracts/outputContracts.ts) — the
  // same shared constants outputSchemas.ts and agentPromptBuilder.ts
  // actually build the real schema/prompt from — instead of a hand-copied
  // field list. A hand-copied list previously let contract drift escape CI:
  // modelProvider/modelName were schema-required but silently absent from
  // the prompt's own field list, and nothing caught it because the test's
  // duplicate list was itself missing them too.
  describe("prompt/schema consistency for required BusinessPlan fields", () => {
    const context = normalizeProjectContext({
      projectId: "proj_prompt_consistency",
      businessName: "Eggreen",
      businessDescription: "Healthy breakfast restaurant",
      industry: "Restaurant & Food",
      businessStage: "Planning",
      country: "Jordan",
      city: "Amman",
      currency: "JOD",
      targetAudience: "young professionals",
      customerAgeRange: "18-35",
      customerType: "Individuals",
      budgetRange: null,
      budgetCurrency: null,
      launchTimeline: "Within 3 months",
      selectedGoals: ["Develop a business strategy"],
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
      currentDate: "2026-07-28T00:00:00.000Z",
    }).context;

    const prompt = buildAgentPrompt({
      agentId: "business_strategist",
      projectContext: context,
      upstreamArtifacts: {},
      requiredSchemaName: "BusinessPlan",
    });

    const modelOwnedFields = BUSINESS_PLAN_REQUIRED_FIELDS.filter(
      (field) => !(BUSINESS_PLAN_SYSTEM_OWNED_FIELDS as readonly string[]).includes(field),
    );

    it("every model-owned required field is named in the live prompt", () => {
      for (const field of modelOwnedFields) {
        expect(prompt).toContain(field);
      }
    });

    it("system-owned fields are real BusinessPlan required fields (the constants haven't drifted apart)", () => {
      for (const field of BUSINESS_PLAN_SYSTEM_OWNED_FIELDS) {
        expect(BUSINESS_PLAN_REQUIRED_FIELDS as readonly string[]).toContain(field);
      }
    });

    it("model-owned + system-owned together account for every required field, with no overlap", () => {
      const combined = new Set([...modelOwnedFields, ...BUSINESS_PLAN_SYSTEM_OWNED_FIELDS]);
      expect(combined.size).toBe(BUSINESS_PLAN_REQUIRED_FIELDS.length);
      for (const field of BUSINESS_PLAN_REQUIRED_FIELDS) {
        expect(combined.has(field)).toBe(true);
      }
    });
  });
});
