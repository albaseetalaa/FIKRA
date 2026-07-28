import { describe, expect, it } from "vitest";
import { validateModel } from "../validation/validator";
import { validBusinessPlan } from "./mocks";
import { buildAgentPrompt } from "../prompts/agentPromptBuilder";
import { normalizeProjectContext } from "../context";

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

  it("keeps prompt/schema consistency for required BusinessPlan fields", () => {
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

    const requiredFieldSnippets = [
      "businessName",
      "country",
      "city",
      "currency",
      "businessStage",
      "executiveSummary",
      "problem",
      "solution",
      "valueProposition",
      "targetMarket",
      "customerSegments",
      "businessVertical",
      "primaryRevenueModel",
      "secondaryRevenueModels",
      "operatingModel",
      "salesChannels",
      "revenueComponents",
      "competitiveAdvantage",
      "objectives",
      "milestones",
      "risks",
      "assumptions",
      "missingInputs",
      "confidenceLevel",
      "evidenceSummary",
      "generatedAt",
      "contextVersion",
      "verticalTemplateVersion",
      "sourceClassification",
    ];

    for (const field of requiredFieldSnippets) {
      expect(prompt).toContain(field);
    }
  });
});
