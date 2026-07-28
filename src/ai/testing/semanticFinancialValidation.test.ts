import { describe, expect, it } from "vitest";
import { validateModel } from "../validation/validator";
import { validFinancialModel } from "./mocks";

const restaurantContext = {
  projectId: "proj_fin_restaurant",
  businessName: "Eggreen",
  businessDescription: "Healthy egg breakfast restaurant",
  industry: "Restaurant & Food",
  businessStage: "planning",
  country: "Jordan",
  city: "Amman",
  currency: "JOD",
  currencySource: "country_default",
  targetAudience: ["professionals"],
  customerAgeRange: "18-35",
  customerType: "Individuals",
  budgetRange: null,
  budgetCurrency: null,
  launchTimeline: "Within 3 months",
  selectedGoals: ["Develop a business strategy"],
  currentDate: "2026-07-28T00:00:00.000Z",
  projectCreatedAt: "2026-07-28T00:00:00.000Z",
  businessVertical: "restaurant_food_service",
  businessVerticalConfidence: 0.88,
  revenueModelType: "transaction_sales",
  revenueChannels: ["dine_in", "takeaway", "delivery"],
  businessModelCategory: "transaction_sales",
  contextVersion: "1.0.0",
} as const;

describe("financial semantic validation", () => {
  it("accepts valid restaurant model with required restaurant signals", () => {
    const r = validateModel("FinancialModel", validFinancialModel, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(true);
  });

  it("rejects restaurant model with SaaS-only signals", () => {
    const invalid = {
      ...validFinancialModel,
      revenueDrivers: [...validFinancialModel.revenueDrivers, "mrr"],
      financialKPIs: [...validFinancialModel.financialKPIs, "arr", "churn"],
      pricingRecommendation: [
        {
          tier: "Starter",
          recommendedPrice: validFinancialModel.pricingRecommendation[0]!.recommendedPrice,
          reasoning: "SaaS tiering",
          targetCustomer: "Teams",
        },
      ],
    };

    const r = validateModel("FinancialModel", invalid, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors.some((issue) => issue.message.includes("forbidden signals"))).toBe(true);
    }
  });

  it("rejects missing monetary currency or period", () => {
    const invalid = {
      ...validFinancialModel,
      startupCosts: [
        {
          ...validFinancialModel.startupCosts[0]!,
          value: {
            ...validFinancialModel.startupCosts[0]!.value,
            currency: "",
            period: undefined,
          },
        },
      ],
    };

    const r = validateModel("FinancialModel", invalid, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(false);
  });

  it("rejects incoherent scenario net profit totals", () => {
    const invalid = {
      ...validFinancialModel,
      financialForecast: validFinancialModel.financialForecast.map((scenario) => ({
        ...scenario,
        netProfit: {
          ...scenario.netProfit,
          amount: scenario.netProfit.amount + 9999,
        },
      })),
    };

    const r = validateModel("FinancialModel", invalid, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors.some((issue) => issue.message.includes("incoherent"))).toBe(true);
    }
  });

  it("rejects formula that does not reference input values", () => {
    const invalid = {
      ...validFinancialModel,
      startupCosts: [
        {
          ...validFinancialModel.startupCosts[0]!,
          formula: "fixed_cost",
          inputValues: [
            { name: "units", value: 10 },
            { name: "average_unit_cost", value: 4000 },
          ],
        },
      ],
    };

    const r = validateModel("FinancialModel", invalid, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(false);
  });

  it("rejects unsupported precision from model assumptions", () => {
    const invalid = {
      ...validFinancialModel,
      operatingCosts: [
        {
          ...validFinancialModel.operatingCosts[0]!,
          value: {
            ...validFinancialModel.operatingCosts[0]!.value,
            sourceType: "model_assumption",
            confidence: 0.98,
          },
        },
      ],
    };

    const r = validateModel("FinancialModel", invalid, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(false);
  });
});
