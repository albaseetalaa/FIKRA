// Shared ProjectContext test fixture. Hand-built ProjectContext literals in
// tests drift out of sync with the canonical budget/timeline catalogs (e.g.
// setting budgetRange: "under_5000" without also setting the budgetMax that
// implies, or launchTimeline: "within_3_months" without its mode/days).
// This fixture derives those dependent fields from the real catalog so test
// contexts stay internally coherent, and changes to the catalog surface here
// instead of silently going stale in test data.

import { findBudgetRangeOption, findLaunchTimelineOption } from "./budgetTimelineOptions";
import type { ProjectContext } from "./types";

const DEFAULT_BUDGET_RANGE = "under_5000";
const DEFAULT_LAUNCH_TIMELINE = "within_3_months";

export function createProjectContextFixture(overrides: Partial<ProjectContext> = {}): ProjectContext {
  const budgetRange = overrides.budgetRange !== undefined ? overrides.budgetRange : DEFAULT_BUDGET_RANGE;
  const launchTimeline = overrides.launchTimeline !== undefined ? overrides.launchTimeline : DEFAULT_LAUNCH_TIMELINE;

  const budgetOption = findBudgetRangeOption(budgetRange);
  const launchTimelineOption = findLaunchTimelineOption(launchTimeline);

  const base: ProjectContext = {
    projectId: "proj_fixture",
    businessName: "Fixture Business",
    businessDescription: "A healthy breakfast restaurant concept for busy professionals.",
    industry: "Restaurant & Food",
    businessStage: "planning",
    country: "Jordan",
    city: "Amman",
    currency: "JOD",
    currencySource: "country_default",
    targetAudience: ["professionals"],
    customerAgeRange: null,
    customerType: "Individuals",
    budgetRange,
    budgetCurrency: null,
    budgetMin: budgetOption?.min ?? null,
    budgetMax: budgetOption?.max ?? null,
    launchTimeline,
    launchTimelineMode: launchTimelineOption?.mode ?? null,
    launchTimelineDays: launchTimelineOption?.days ?? null,
    selectedGoals: ["Develop strategy"],
    currentDate: "2026-07-28T00:00:00.000Z",
    projectCreatedAt: "2026-07-28T00:00:00.000Z",
    businessVertical: "restaurant_food_service",
    businessVerticalConfidence: 0.9,
    primaryRevenueModel: "transaction_sales",
    secondaryRevenueModels: [],
    salesChannels: ["dine_in", "takeaway", "drive_thru", "delivery"],
    revenueComponents: ["transaction_sales", "delivery_fee", "add_on_products"],
    revenueModelType: "transaction_sales",
    revenueChannels: ["dine_in", "takeaway", "drive_thru", "delivery"],
    businessModelCategory: "transaction_sales",
    contextVersion: "1.0.0",
  };

  return { ...base, ...overrides };
}
