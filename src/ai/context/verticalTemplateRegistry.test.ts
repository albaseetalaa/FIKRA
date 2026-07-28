import { describe, expect, it } from "vitest";
import { getVerticalTemplate } from "./verticalTemplateRegistry";
import type { BusinessVertical } from "./types";

describe("vertical template registry", () => {
  const allVerticals: BusinessVertical[] = [
    "restaurant_food_service",
    "ecommerce_retail",
    "professional_services",
    "saas_software",
    "marketplace",
    "subscription_service",
    "physical_retail",
    "manufacturing",
    "real_estate",
    "logistics_delivery",
    "education_training",
    "healthcare_wellness",
    "generic_other",
    "unknown",
  ];

  it("returns restaurant template with restaurant-specific drivers", () => {
    const template = getVerticalTemplate("restaurant_food_service");
    expect(template.verticalId).toBe("restaurant_food_service");
    expect(template.revenueDrivers).toContain("average_order_value");
    expect(template.forbiddenOutputPatterns).toContain("saas_pricing_tiers");
  });

  it("returns saas template with SaaS KPIs", () => {
    const template = getVerticalTemplate("saas_software");
    expect(template.financialKPIs).toContain("ltv_cac_ratio");
    expect(template.revenueDrivers).toContain("mrr");
  });

  it("falls back to generic template for unknown vertical", () => {
    const template = getVerticalTemplate("unknown");
    expect(template.verticalId).toBe("unknown");
    expect(template.allowedOutputPatterns).toContain("requires_user_input");
  });

  it("defines a concrete template for every registered vertical", () => {
    for (const vertical of allVerticals) {
      const template = getVerticalTemplate(vertical);
      expect(template.verticalId).toBe(vertical);
      expect(template.revenueDrivers.length).toBeGreaterThan(0);
      expect(template.costCategories.length).toBeGreaterThan(0);
      expect(template.financialKPIs.length).toBeGreaterThan(0);
    }
  });

  it("falls back to generic_other for unregistered vertical identifier", () => {
    const template = getVerticalTemplate("not_registered_vertical" as BusinessVertical);
    expect(template.verticalId).toBe("generic_other");
  });
});
