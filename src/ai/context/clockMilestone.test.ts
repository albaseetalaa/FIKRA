import { describe, expect, it } from "vitest";
import { normalizeProjectContext } from "./projectContextNormalizer";
import { FixedClock } from "../../lib/time/clock";
import { validateModel } from "../validation/validator";
import { validBusinessPlan } from "../testing/mocks";

describe("deterministic clock and milestone enforcement", () => {
  it("uses fixed clock when currentDate input is invalid", () => {
    const fixedClock = new FixedClock("2026-08-05T10:00:00.000Z");

    const result = normalizeProjectContext(
      {
        projectId: "proj_clock_invalid_current",
        businessName: "Clock Test",
        businessDescription: "Healthy restaurant concept",
        industry: "Restaurant & Food",
        businessStage: "Planning",
        country: "Jordan",
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
        currentDate: "invalid-date",
      },
      fixedClock,
    );

    expect(result.context.currentDate).toBe("2026-08-05T10:00:00.000Z");
    expect(result.validationNotes.some((note) => note.includes("currentDate is invalid"))).toBe(true);
  });

  it("preserves future milestones generated after project creation", () => {
    const plan = {
      ...validBusinessPlan,
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
      milestones: [
        {
          ...validBusinessPlan.milestones[0]!,
          targetDate: "2026-09-01",
          dateSource: "calculated_from_timeline",
        },
      ],
    };

    const validation = validateModel("BusinessPlan", plan);
    expect(validation.success).toBe(true);
  });

  it("rejects stale milestones unless explicitly user-provided", () => {
    const stalePlan = {
      ...validBusinessPlan,
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
      milestones: [
        {
          ...validBusinessPlan.milestones[0]!,
          targetDate: "2024-01-01",
          dateSource: "calculated_from_timeline",
        },
      ],
    };

    const validation = validateModel("BusinessPlan", stalePlan);
    expect(validation.success).toBe(false);
  });

  it("allows stale historical milestone only when marked user_provided", () => {
    const historicalPlan = {
      ...validBusinessPlan,
      projectCreatedAt: "2026-07-28T00:00:00.000Z",
      milestones: [
        {
          ...validBusinessPlan.milestones[0]!,
          targetDate: "2024-01-01",
          dateSource: "user_provided",
        },
      ],
    };

    const validation = validateModel("BusinessPlan", historicalPlan);
    expect(validation.success).toBe(true);
  });
});
