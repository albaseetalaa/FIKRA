import { describe, expect, it } from "vitest";
import { validateModel } from "../validation/validator";
import { validMarketResearchReport } from "./mocks";

describe("market evidence semantic validation", () => {
  it("accepts unavailable competitor outcome when consistently structured", () => {
    const result = validateModel("MarketResearchReport", validMarketResearchReport);
    expect(result.success).toBe(true);
  });

  it("rejects unsupported market claim presented as verified fact", () => {
    const invalid = {
      ...validMarketResearchReport,
      claims: [
        {
          ...validMarketResearchReport.claims[0]!,
          claimId: "claim_overconfident",
          claim: "The market has 200M annual transactions guaranteed next year.",
          evidenceType: "model_assumption",
          validationStatus: "verified",
        },
      ],
    };

    const result = validateModel("MarketResearchReport", invalid);
    expect(result.success).toBe(false);
  });

  it("rejects placeholder competitors", () => {
    const invalid = {
      ...validMarketResearchReport,
      competitorDataStatus: "verified",
      unavailableCompetitorOutcome: null,
      competitors: [
        {
          name: "Competitor A",
          geography: "Amman",
          category: "quick_service_restaurants",
          targetCustomer: "Professionals",
          offering: "Breakfast meals",
          pricePosition: "mid",
          whyItCompetes: "Local convenience",
          strengths: ["location"],
          weaknesses: ["limited healthy options"],
          evidence: {
            sourceType: "requires_validation",
            sourceTitle: null,
            validationStatus: "requires_external_research",
          },
          validationStatus: "requires_external_research",
        },
      ],
    };

    const result = validateModel("MarketResearchReport", invalid);
    expect(result.success).toBe(false);
  });
});
