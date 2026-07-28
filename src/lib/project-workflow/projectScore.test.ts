import { describe, expect, it } from "vitest";
import { calculateProjectScore } from "./projectScore";

const context = {
  projectId: "proj_score",
  businessName: "Eggreen",
  businessDescription: "Healthy breakfast restaurant",
  industry: "Restaurant & Food",
  businessStage: "planning",
  country: "Jordan",
  city: "Amman",
  currency: "JOD",
  currencySource: "country_default",
  targetAudience: ["professionals"],
  customerAgeRange: "18-35",
  customerType: "Individuals",
  budgetRange: "JOD 15,000-50,000",
  budgetCurrency: "JOD",
  launchTimeline: "Within 3 months",
  selectedGoals: ["Develop a business strategy"],
  currentDate: "2026-07-28T00:00:00.000Z",
  projectCreatedAt: "2026-07-28T00:00:00.000Z",
  businessVertical: "restaurant_food_service",
  businessVerticalConfidence: 0.8,
  revenueModelType: "transaction_sales",
  revenueChannels: ["dine_in", "takeaway", "delivery"],
  businessModelCategory: "transaction_sales",
  contextVersion: "1.0.0",
} as const;

describe("project score", () => {
  it("calculates weighted score and dimension breakdown", () => {
    const score = calculateProjectScore({
      context: context as never,
      artifacts: [
        { artifactId: "a1", projectId: "proj_score", agentId: "business_strategist", outputType: "BusinessPlan", content: {}, validationStatus: "valid", version: 1, schemaVersion: 1, artifactVersion: 1, createdAt: "2026-07-28", updatedAt: "2026-07-28" },
        { artifactId: "a2", projectId: "proj_score", agentId: "market_research", outputType: "MarketResearchReport", content: {}, validationStatus: "valid", version: 1, schemaVersion: 1, artifactVersion: 1, createdAt: "2026-07-28", updatedAt: "2026-07-28" },
        { artifactId: "a3", projectId: "proj_score", agentId: "financial_analyst", outputType: "FinancialModel", content: {}, validationStatus: "valid", version: 1, schemaVersion: 1, artifactVersion: 1, createdAt: "2026-07-28", updatedAt: "2026-07-28" },
      ],
    });

    expect(score.notEnoughData).toBe(false);
    expect(score.overallScore).not.toBeNull();
    expect(score.dimensions.length).toBeGreaterThan(0);
    expect(score.calculationExplanation.length).toBeGreaterThan(10);
  });

  it("returns notEnoughData when no core artifacts exist", () => {
    const score = calculateProjectScore({
      context: context as never,
      artifacts: [],
    });

    expect(score.notEnoughData).toBe(true);
    expect(score.overallScore).toBeNull();
  });
});
