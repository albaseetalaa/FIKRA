import { describe, expect, it } from "vitest";
import {
  classifyBusinessVertical,
  classifyRevenueModel,
  normalizeProjectContext,
  resolveCurrency,
  supportsSaasStylePricing,
} from "./index";

describe("project context hardening", () => {
  it("flags missing required context fields", () => {
    const result = normalizeProjectContext({
      projectId: "proj_missing_required",
      businessName: "Eggreen",
      businessDescription: "Healthy breakfast restaurant",
      industry: "Restaurant & Food",
      businessStage: "Planning",
      country: null,
      city: "Amman",
      currency: null,
      targetAudience: "young professionals",
      customerAgeRange: "18-35",
      customerType: "Individuals",
      budgetRange: null,
      budgetCurrency: null,
      launchTimeline: "Within 3 months",
      selectedGoals: ["Develop a business strategy"],
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
      currentDate: "2026-07-28T00:00:00.000Z",
    });

    expect(result.status).toBe("requires_user_input");
    expect(result.missingRequiredContext).toContain("country");
  });

  it("normalizes a restaurant context with Jordan currency resolution", () => {
    const result = normalizeProjectContext({
      projectId: "proj_eggreen",
      businessName: "Eggreen",
      businessDescription: "Healthy egg-based breakfast restaurant with dine in and takeaway in Amman.",
      industry: "Restaurant & Food",
      businessStage: "Planning",
      country: "jordan",
      city: "amman",
      currency: null,
      targetAudience: "young professionals, students",
      customerAgeRange: "18-35",
      customerType: "Individuals",
      budgetRange: "JOD 15,000-50,000",
      budgetCurrency: null,
      launchTimeline: "Within 3 months",
      selectedGoals: ["Develop a business strategy"],
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
      currentDate: "2026-07-28T00:00:00.000Z",
    });

    expect(result.context.businessName).toBe("Eggreen");
    expect(result.context.businessVertical).toBe("restaurant_food_service");
    expect(result.context.primaryRevenueModel).toBe("transaction_sales");
    expect(result.context.salesChannels).toEqual(["dine_in", "takeaway", "drive_thru", "delivery"]);
    expect(result.context.currency).toBe("JOD");
    expect(result.status).toBe("valid");
  });

  it("does not classify explicit non-marketplace subscription concept as marketplace commission", () => {
    const result = normalizeProjectContext({
      projectId: "proj_not_marketplace",
      businessName: "Eggreen Home",
      businessDescription:
        "Direct-to-consumer subscription brand for healthy egg breakfast. Not a marketplace. Weekly membership plans.",
      industry: "Restaurant & Food",
      businessStage: "Planning",
      country: "Jordan",
      city: "Amman",
      currency: "JOD",
      targetAudience: "families, professionals",
      customerAgeRange: null,
      customerType: "Individuals",
      budgetRange: null,
      budgetCurrency: null,
      launchTimeline: "Within 3 months",
      selectedGoals: ["Validate demand"],
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
      currentDate: "2026-07-28T00:00:00.000Z",
    });

    expect(result.revenueModelClassification.primaryRevenueModel).not.toBe("marketplace_commission");
    expect(result.context.primaryRevenueModel).not.toBe("marketplace_commission");
  });

  it("marks contradictions as invalid", () => {
    const result = normalizeProjectContext({
      projectId: "proj_conflict",
      businessName: "Conflict",
      businessDescription: "Restaurant with menu and kitchen workflow.",
      industry: "SaaS",
      businessStage: "Operating",
      country: "Jordan",
      city: "Amman",
      currency: "JOD",
      targetAudience: "local",
      customerAgeRange: null,
      customerType: null,
      budgetRange: null,
      budgetCurrency: null,
      launchTimeline: "As soon as possible",
      selectedGoals: [],
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
      currentDate: "2026-07-28T00:00:00.000Z",
    });

    expect(result.status).toBe("invalid");
    expect(result.contradictions.length).toBeGreaterThan(0);
  });

  it("does not silently classify ambiguous projects as SaaS", () => {
    const classification = classifyBusinessVertical({
      industry: "Other",
      businessDescription: "I want to start a business and make money fast.",
      selectedGoals: [],
      customerType: null,
    });

    expect(classification.vertical === "saas_software").toBe(false);
    expect(classification.requiresUserConfirmation).toBe(true);
  });

  it("uses explicit currency override over country defaults", () => {
    const currency = resolveCurrency({
      explicitCurrency: "USD",
      budgetCurrency: null,
      budgetRange: "JOD 20,000",
      country: "Jordan",
    });

    expect(currency.currencyCode).toBe("USD");
    expect(currency.resolutionSource).toBe("user_selected");
  });

  it("classifies SaaS revenue appropriately and allows SaaS pricing guard", () => {
    const revenue = classifyRevenueModel({
      businessVertical: "saas_software",
      businessDescription: "B2B software platform with subscription billing",
      selectedGoals: [],
    });

    expect(["subscription", "mixed"]).toContain(revenue.primaryRevenueModel);
    expect(Array.isArray(revenue.salesChannels)).toBe(true);
    expect(Array.isArray(revenue.revenueComponents)).toBe(true);
    const allowed = supportsSaasStylePricing({
      vertical: "saas_software",
      revenueModel: revenue.primaryRevenueModel,
      secondary: revenue.secondaryRevenueModels,
    });
    expect(allowed).toBe(true);
  });

  it("blocks SaaS pricing for restaurant transaction model", () => {
    const allowed = supportsSaasStylePricing({
      vertical: "restaurant_food_service",
      revenueModel: "transaction_sales",
      secondary: [],
    });
    expect(allowed).toBe(false);
  });

  it("falls back to Unnamed Project when business name is absent", () => {
    const result = normalizeProjectContext({
      projectId: "proj_legacy",
      businessName: null,
      businessDescription: "Consulting services for SMEs.",
      industry: "Professional Services",
      businessStage: "Planning",
      country: "United Kingdom",
      city: "London",
      currency: null,
      targetAudience: "SMEs",
      customerAgeRange: null,
      customerType: "Businesses",
      budgetRange: null,
      budgetCurrency: null,
      launchTimeline: "Within 3 months",
      selectedGoals: [],
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
      currentDate: "2026-07-28T00:00:00.000Z",
    });

    expect(result.context.businessName).toBe("Unnamed Project");
  });
});
