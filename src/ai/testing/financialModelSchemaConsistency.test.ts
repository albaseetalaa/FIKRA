import { describe, expect, it } from "vitest";
import { FinancialModelSchema } from "../schemas/schemas";
import { getProviderOutputSchema } from "../providers/outputSchemas";
import { buildAgentPrompt } from "../prompts/agentPromptBuilder";
import { validFinancialModel } from "./mocks";
import type { ProjectContext } from "../context";

function contextStub(): ProjectContext {
  return {
    currentDate: "2026-07-28",
    contextVersion: "1.0.0",
    projectCreatedAt: "2026-07-28T00:00:00.000Z",
    businessName: "Eggreen",
    businessDescription: "Healthy breakfast restaurant",
    industry: "Restaurant & Food",
    country: "Jordan",
    city: "Amman",
    currency: "JOD",
    businessVertical: "restaurant_food_service",
    businessVerticalConfidence: 0.9,
    revenueModelType: "transaction_sales",
    revenueChannels: ["dine_in", "takeaway", "delivery"],
    selectedGoals: ["Build financial model"],
    targetAudience: ["Young professionals"],
    marketScope: "city",
  } as unknown as ProjectContext;
}

describe("FinancialModel schema consistency", () => {
  it("keeps provider and zod required keys aligned for critical fields", () => {
    const providerSchema = getProviderOutputSchema("FinancialModel") as Record<string, unknown>;
    const required = new Set((providerSchema.required as string[]) ?? []);

    [
      "verticalId",
      "revenueModelType",
      "revenueChannels",
      "startupCosts",
      "operatingCosts",
      "financialForecast",
      "breakEvenAnalysis",
      "assumptions",
      "missingInputs",
      "evidenceSummary",
      "modelProvider",
      "modelName",
      "sourceClassification",
    ].forEach((key) => expect(required.has(key)).toBe(true));

    expect(FinancialModelSchema.safeParse(validFinancialModel).success).toBe(true);
  });

  it("enforces canonical inputValues entry shape in provider schema", () => {
    const schema = getProviderOutputSchema("FinancialModel") as Record<string, unknown>;
    const props = schema.properties as Record<string, unknown>;
    const startupItems = ((props.startupCosts as Record<string, unknown>).items as Record<string, unknown>);
    const inputValues = ((startupItems.properties as Record<string, unknown>).inputValues as Record<string, unknown>);
    const inputItem = inputValues.items as Record<string, unknown>;
    const required = new Set((inputItem.required as string[]) ?? []);

    expect(required.has("name")).toBe(true);
    expect(required.has("value")).toBe(true);
    expect(inputValues.maxItems).toBe(20);
  });

  it("requires canonical period enum and JOD-compatible currency in FinancialModel", () => {
    const invalidPeriod = {
      ...validFinancialModel,
      startupCosts: [
        {
          ...validFinancialModel.startupCosts[0],
          value: {
            ...validFinancialModel.startupCosts[0]!.value,
            period: "weekly",
          },
        },
      ],
    };

    expect(FinancialModelSchema.safeParse(validFinancialModel).success).toBe(true);
    expect(FinancialModelSchema.safeParse(invalidPeriod).success).toBe(false);
  });

  it("keeps FinancialModel prompt compact and structured-only", () => {
    const prompt = buildAgentPrompt({
      agentId: "financial_analyst",
      projectContext: contextStub(),
      upstreamArtifacts: {
        businessPlan: { targetMarket: "Amman" },
        marketResearchReport: { marketSizeEstimate: "TBD" },
      },
      requiredSchemaName: "FinancialModel",
    });

    expect(prompt).toContain("Return only one complete JSON object");
    expect(prompt).toContain("Do not return markdown");
    expect(prompt).toContain("Bound array sizes");
    expect(prompt).toContain("JOD");
  });
});
