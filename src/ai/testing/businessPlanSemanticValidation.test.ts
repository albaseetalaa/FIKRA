import { describe, expect, it } from "vitest";
import { validateModel } from "../validation/validator";
import { validBusinessPlan } from "./mocks";

const restaurantContext = {
  projectId: "proj_bp_restaurant",
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
  primaryRevenueModel: "transaction_sales",
  secondaryRevenueModels: [],
  salesChannels: ["dine_in", "takeaway", "drive_thru", "delivery"],
  revenueComponents: ["transaction_sales", "delivery_fee", "add_on_products"],
  revenueChannels: ["dine_in", "takeaway", "drive_thru", "delivery"],
  businessModelCategory: "transaction_sales",
  contextVersion: "1.0.0",
} as const;

describe("business plan semantic validation", () => {
  it("accepts valid business plan", () => {
    const r = validateModel("BusinessPlan", validBusinessPlan, {
      projectContext: restaurantContext as never,
    });
    expect(r.success).toBe(true);
  });

  it("rejects generic objective text without measurable framing", () => {
    const invalid = {
      ...validBusinessPlan,
      objectives: [
        {
          id: "obj-generic",
          statement: "Grow the business",
          metric: "",
          targetValue: "",
          timeHorizon: "",
        },
      ],
    };

    const r = validateModel("BusinessPlan", invalid, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(false);
  });

  it("rejects unordered milestone dates", () => {
    const invalid = {
      ...validBusinessPlan,
      milestones: [
        {
          ...validBusinessPlan.milestones[0]!,
          id: "ms-late",
          targetDate: "2026-12-01",
        },
        {
          ...validBusinessPlan.milestones[0]!,
          id: "ms-early",
          targetDate: "2026-09-01",
        },
      ],
    };

    const r = validateModel("BusinessPlan", invalid, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(false);
  });

  it("rejects revenue model mismatch against ProjectContext", () => {
    const invalid = {
      ...validBusinessPlan,
      primaryRevenueModel: "subscription",
    };

    const r = validateModel("BusinessPlan", invalid, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(false);
  });

  it("rejects channel mismatch for transaction_sales model", () => {
    const invalid = {
      ...validBusinessPlan,
      salesChannels: ["website"],
    };

    const r = validateModel("BusinessPlan", invalid, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors.some((issue) => issue.message.includes("sales channels are unsupported"))).toBe(true);
    }
  });

  it("allows user-provided historical milestone dates", () => {
    const historical = {
      ...validBusinessPlan,
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
      milestones: [
        {
          ...validBusinessPlan.milestones[0]!,
          targetDate: "2025-12-01",
          dateSource: "user_provided",
        },
      ],
    };

    const r = validateModel("BusinessPlan", historical, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(true);
  });

  it("accepts contextual competition risk phrasing", () => {
    const contextualRisk = {
      ...validBusinessPlan,
      risks: [
        "Competition from established breakfast and fast-food chains near target neighborhoods in Amman.",
      ],
    };

    const r = validateModel("BusinessPlan", contextualRisk, {
      projectContext: restaurantContext as never,
    });

    expect(r.success).toBe(true);
  });
});
