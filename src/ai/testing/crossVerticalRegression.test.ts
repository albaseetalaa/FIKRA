import { describe, expect, it } from "vitest";
import { buildAgentPrompt } from "../prompts/agentPromptBuilder";
import { normalizeProjectContext } from "../context";

function normalizeFixture(input: {
  projectId: string;
  businessName: string;
  businessDescription: string;
  industry: string;
  country: string;
  city: string;
  stage?: string;
  goals?: string[];
  currency?: string | null;
}) {
  return normalizeProjectContext({
    projectId: input.projectId,
    businessName: input.businessName,
    businessDescription: input.businessDescription,
    industry: input.industry,
    businessStage: input.stage ?? "Planning",
    country: input.country,
    city: input.city,
    currency: input.currency ?? null,
    targetAudience: "professionals, startups",
    customerAgeRange: "18-45",
    customerType: "Individuals",
    budgetRange: null,
    budgetCurrency: null,
    launchTimeline: "Within 3 months",
    selectedGoals: input.goals ?? ["Develop a business strategy"],
    projectCreatedAt: "2026-07-28T00:00:00.000Z",
    currentDate: "2026-07-28T00:00:00.000Z",
  });
}

describe("cross-vertical regression", () => {
  it("Eggreen restaurant fixture resolves expected vertical/model/currency and blocks SaaS tiers", () => {
    const result = normalizeFixture({
      projectId: "proj_eggreen",
      businessName: "Eggreen",
      businessDescription: "Healthy egg-based breakfast restaurant with dine in, takeaway, drive thru, and delivery.",
      industry: "Restaurant & Food",
      country: "Jordan",
      city: "Amman",
    });

    expect(result.context.businessVertical).toBe("restaurant_food_service");
    expect(result.context.primaryRevenueModel).toBe("transaction_sales");
    expect(result.context.salesChannels).toEqual(["dine_in", "takeaway", "drive_thru", "delivery"]);
    expect(result.context.currency).toBe("JOD");

    const prompt = buildAgentPrompt({
      agentId: "financial_analyst",
      projectContext: result.context,
      upstreamArtifacts: {},
      requiredSchemaName: "FinancialModel",
    });

    expect(prompt).toContain("Do not use SaaS pricing tiers Starter/Professional/Business/Enterprise.");
  });

  it("SaaS fixture allows subscription-oriented guidance", () => {
    const result = normalizeFixture({
      projectId: "proj_saas",
      businessName: "FlowOps",
      businessDescription: "B2B SaaS workflow automation platform with monthly subscriptions and usage add-ons.",
      industry: "Technology",
      country: "United States",
      city: "Austin",
    });

    expect(result.context.businessVertical).toBe("saas_software");
    expect(["subscription", "mixed", "usage_based"]).toContain(result.context.primaryRevenueModel);

    const prompt = buildAgentPrompt({
      agentId: "financial_analyst",
      projectContext: result.context,
      upstreamArtifacts: {},
      requiredSchemaName: "FinancialModel",
    });

    expect(prompt).not.toContain("Do not use SaaS pricing tiers Starter/Professional/Business/Enterprise.");
  });

  it("e-commerce fixture resolves transaction-sales style model", () => {
    const result = normalizeFixture({
      projectId: "proj_ecom",
      businessName: "DesertCart",
      businessDescription: "Online retail store for home goods with fulfillment, shipping, and returns workflows.",
      industry: "Retail & E-commerce",
      country: "United Arab Emirates",
      city: "Dubai",
    });

    expect(result.context.businessVertical).toBe("ecommerce_retail");
    expect(result.context.primaryRevenueModel).toBe("transaction_sales");
    expect(result.context.currency).toBe("AED");
  });

  it("professional services fixture resolves service-fees model", () => {
    const result = normalizeFixture({
      projectId: "proj_services",
      businessName: "Northbridge Studio",
      businessDescription: "Consulting and design services with billable hours and project retainers.",
      industry: "Professional Services",
      country: "United Kingdom",
      city: "London",
    });

    expect(result.context.businessVertical).toBe("professional_services");
    expect(["service_fees", "mixed"]).toContain(result.context.primaryRevenueModel);
    expect(result.context.currency).toBe("GBP");
  });

  it("marketplace fixture resolves marketplace commission model", () => {
    const result = normalizeFixture({
      projectId: "proj_market",
      businessName: "CraftLink",
      businessDescription: "Two-sided marketplace connecting local artisans with urban buyers using take-rate commissions.",
      industry: "Marketplace",
      country: "Saudi Arabia",
      city: "Riyadh",
    });

    expect(result.context.businessVertical).toBe("marketplace");
    expect(["marketplace_commission", "mixed"]).toContain(result.context.primaryRevenueModel);
    expect(result.context.currency).toBe("SAR");
  });

  it("direct-to-consumer subscription project with explicit non-marketplace signal does not classify as marketplace", () => {
    const result = normalizeFixture({
      projectId: "proj_d2c_sub_not_marketplace",
      businessName: "Eggreen Home",
      businessDescription:
        "Direct-to-consumer egg breakfast subscription brand with weekly delivery plans. This is not a marketplace.",
      industry: "Restaurant & Food",
      country: "Jordan",
      city: "Amman",
    });

    expect(result.context.primaryRevenueModel).not.toBe("marketplace_commission");
    expect(result.revenueModelClassification.primaryRevenueModel).not.toBe("marketplace_commission");
  });

  it("ambiguous fixture does not silently default to SaaS", () => {
    const result = normalizeFixture({
      projectId: "proj_unknown",
      businessName: "Mystery Venture",
      businessDescription: "I want to start a business and grow quickly with modern tools.",
      industry: "Other",
      country: "Jordan",
      city: "Amman",
    });

    expect(result.context.businessVertical).not.toBe("saas_software");
    expect(result.status === "requires_user_input" || result.context.businessVertical === "unknown" || result.context.businessVertical === "generic_other").toBe(true);
  });
});
