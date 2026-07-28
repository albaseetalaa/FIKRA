import { describe, it, expect } from "vitest";
import { validateModel } from "../validation/validator";
import mocks from "./mocks";

describe("Validator", () => {
  it("accepts a valid BusinessPlan", () => {
    const r = validateModel("BusinessPlan", mocks.validBusinessPlan);
    expect(r.success).toBe(true);
  });

  it("rejects an invalid BusinessPlan", () => {
    const r = validateModel("BusinessPlan", mocks.invalidBusinessPlan as unknown);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors.length).toBeGreaterThan(0);
    }
  });

  it("rejects stale milestone dates in BusinessPlan", () => {
    const stalePlan = {
      ...mocks.validBusinessPlan,
      generatedAt: "2026-07-28T00:00:00.000Z",
      milestones: [
        {
          id: "m-stale",
          title: "Old milestone",
          description: "Should fail",
          targetDate: "2024-01-01",
          dateSource: "calculated_from_timeline",
          dependencies: [],
          confidence: 0.8,
          assumptions: [],
        },
      ],
    };

    const r = validateModel("BusinessPlan", stalePlan as unknown);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors.some((issue) => issue.message.includes("Stale milestone date detected"))).toBe(true);
    }
  });

  it("detects malformed JSON as failure when parsing", () => {
    const r = validateModel("BusinessPlan", mocks.malformedResponse as unknown);
    expect(r.success).toBe(false);
  });

  it("accepts a valid MarketResearchReport", () => {
    const r = validateModel("MarketResearchReport", mocks.validMarketResearchReport);
    expect(r.success).toBe(true);
  });

  it("rejects an invalid MarketResearchReport", () => {
    const r = validateModel("MarketResearchReport", { summary: 123 } as unknown);
    expect(r.success).toBe(false);
  });

  it("accepts a valid FinancialModel", () => {
    const r = validateModel("FinancialModel", mocks.validFinancialModel);
    expect(r.success).toBe(true);
  });

  it("rejects an invalid FinancialModel", () => {
    const r = validateModel("FinancialModel", { startupCosts: "bad" } as unknown);
    expect(r.success).toBe(false);
  });
});
