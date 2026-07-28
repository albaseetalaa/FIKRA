import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "./capabilityRegistry";

describe("capability registry", () => {
  it("marks core implemented capabilities as generated when artifacts exist", () => {
    const caps = resolveCapabilities({
      selectedGoals: ["Develop a business strategy"],
      artifacts: [
        {
          artifactId: "bp1",
          projectId: "p1",
          outputType: "BusinessPlan",
          content: {},
          validationStatus: "valid",
          agentId: "business_strategist",
          version: 1,
          schemaVersion: 1,
          artifactVersion: 1,
          createdAt: "2026-07-28",
          updatedAt: "2026-07-28",
        },
      ],
    });

    const businessPlan = caps.find((cap) => cap.id === "business_plan");
    expect(businessPlan?.status).toBe("generated");
  });

  it("marks coming-soon selected goals as selected_but_not_available", () => {
    const caps = resolveCapabilities({
      selectedGoals: ["Build a brand identity"],
      artifacts: [],
    });

    const brand = caps.find((cap) => cap.id === "brand_identity");
    expect(brand?.status).toBe("selected_but_not_available");
  });

  it("marks competitor analysis generated when market artifact declares unavailable competitor outcome", () => {
    const caps = resolveCapabilities({
      selectedGoals: ["Develop a business strategy"],
      artifacts: [
        {
          artifactId: "mr1",
          projectId: "p1",
          outputType: "MarketResearchReport",
          content: {
            competitorDataStatus: "unavailable",
            unavailableCompetitorOutcome: {
              competitorDataStatus: "unavailable",
              competitorCategoriesToInvestigate: ["quick_service_restaurants"],
            },
            competitors: [],
          },
          validationStatus: "valid",
          agentId: "market_research",
          version: 1,
          schemaVersion: 1,
          artifactVersion: 1,
          createdAt: "2026-07-28",
          updatedAt: "2026-07-28",
        },
      ],
    });

    const competitor = caps.find((cap) => cap.id === "competitor_analysis");
    expect(competitor?.status).toBe("generated");
  });
});
