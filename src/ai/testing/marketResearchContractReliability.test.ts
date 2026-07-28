import { describe, expect, it } from "vitest";
import { validateModel } from "../validation/validator";
import { validMarketResearchReport } from "./mocks";

describe("MarketResearchReport contract reliability", () => {
  it("accepts a valid structured MarketResearchReport", () => {
    const result = validateModel("MarketResearchReport", validMarketResearchReport);
    expect(result.success).toBe(true);
  });

  it("accepts nullable source fields for model_assumption claims", () => {
    const report = {
      ...validMarketResearchReport,
      claims: [
        {
          ...validMarketResearchReport.claims[0]!,
          evidenceType: "model_assumption",
          validationStatus: "requires_external_research",
          source: null,
          sourceTitle: null,
          sourceDate: null,
        },
      ],
    };

    const result = validateModel("MarketResearchReport", report);
    expect(result.success).toBe(true);
  });

  it("accepts verified-source claim with validated source fields", () => {
    const report = {
      ...validMarketResearchReport,
      claims: [
        {
          ...validMarketResearchReport.claims[0]!,
          evidenceType: "verified_source",
          validationStatus: "verified",
          source: "internal_reference:source-1",
          sourceTitle: "Local industry report",
          sourceDate: "2026-07-28",
        },
      ],
      competitorDataStatus: "verified",
      unavailableCompetitorOutcome: null,
      competitors: [
        {
          name: "GreenPlate",
          geography: "Amman",
          category: "healthy_breakfast",
          targetCustomer: "Professionals",
          offering: "Healthy breakfast combos",
          pricePosition: "mid",
          whyItCompetes: "Strong breakfast focus",
          strengths: ["menu variety"],
          weaknesses: ["limited delivery"],
          evidence: {
            sourceType: "verified_source",
            sourceTitle: "Store audit",
            validationStatus: "verified",
          },
          validationStatus: "verified",
        },
      ],
    };

    const result = validateModel("MarketResearchReport", report);
    expect(result.success).toBe(true);
  });

  it("rejects evidenceType and validationStatus enum confusion", () => {
    const report = {
      ...validMarketResearchReport,
      claims: [
        {
          ...validMarketResearchReport.claims[0]!,
          validationStatus: "verified_source",
        },
      ],
    };

    const result = validateModel("MarketResearchReport", report);
    expect(result.success).toBe(false);
  });

  it("rejects missing claim generatedAt", () => {
    const report = {
      ...validMarketResearchReport,
      claims: [
        (() => {
          const invalid = { ...validMarketResearchReport.claims[0]! } as Record<string, unknown>;
          delete invalid.generatedAt;
          return invalid;
        })(),
      ],
    };

    const result = validateModel("MarketResearchReport", report);
    expect(result.success).toBe(false);
  });

  it("rejects verified_source claims with nullable source fields", () => {
    const report = {
      ...validMarketResearchReport,
      claims: [
        {
          ...validMarketResearchReport.claims[0]!,
          evidenceType: "verified_source",
          validationStatus: "verified",
          source: null,
          sourceTitle: null,
          sourceDate: null,
        },
      ],
    };

    const result = validateModel("MarketResearchReport", report);
    expect(result.success).toBe(false);
  });

  it("rejects unavailable competitor outcome with missing required arrays", () => {
    const report = {
      ...validMarketResearchReport,
      unavailableCompetitorOutcome: {
        competitorDataStatus: "unavailable",
        competitorCategoriesToInvestigate: ["quick_service_restaurants"],
        requiredResearchActions: ["field mapping"],
      },
    };

    const result = validateModel("MarketResearchReport", report);
    expect(result.success).toBe(false);
  });

  it("rejects placeholder competitors", () => {
    const report = {
      ...validMarketResearchReport,
      competitorDataStatus: "verified",
      unavailableCompetitorOutcome: null,
      competitors: [
        {
          name: "Competitor A",
          geography: "Amman",
          category: "healthy_breakfast",
          targetCustomer: "Professionals",
          offering: "Breakfast meals",
          pricePosition: "mid",
          whyItCompetes: "Location",
          strengths: ["footfall"],
          weaknesses: ["limited menu"],
          evidence: {
            sourceType: "requires_validation",
            sourceTitle: null,
            validationStatus: "requires_external_research",
          },
          validationStatus: "requires_external_research",
        },
      ],
    };

    const result = validateModel("MarketResearchReport", report);
    expect(result.success).toBe(false);
  });
});
