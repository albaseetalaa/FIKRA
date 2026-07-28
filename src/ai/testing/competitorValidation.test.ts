import { describe, expect, it } from "vitest";
import { validateModel } from "../validation/validator";
import { validMarketResearchReport } from "./mocks";

describe("competitor validation", () => {
  it("rejects unavailable competitor status without fallback outcome", () => {
    const invalid = {
      ...validMarketResearchReport,
      competitorDataStatus: "unavailable",
      unavailableCompetitorOutcome: null,
      competitors: [],
    };

    const result = validateModel("MarketResearchReport", invalid);
    expect(result.success).toBe(false);
  });

  it("rejects unavailable competitor status when competitor list is non-empty", () => {
    const invalid = {
      ...validMarketResearchReport,
      competitorDataStatus: "unavailable",
      competitors: [
        {
          name: "Real Name",
          geography: "Amman",
          category: "healthy_food_chains",
          targetCustomer: "Professionals",
          offering: "Healthy meals",
          pricePosition: "mid",
          whyItCompetes: "Strong location",
          strengths: ["brand"],
          weaknesses: ["price"],
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
