import { describe, expect, it } from "vitest";
import { getOutputBudget, getOutputBudgetByOutputModel } from "../providers/outputBudgets";

describe("output budgets", () => {
  it("defines FinancialModel budget higher than BusinessPlan and MarketResearchReport", () => {
    const bs = getOutputBudget("BusinessPlan");
    const mr = getOutputBudget("MarketResearchReport");
    const fm = getOutputBudget("FinancialModel");

    expect(fm.base).toBeGreaterThan(bs.base);
    expect(fm.base).toBeGreaterThan(mr.base);
    expect(fm.max).toBeGreaterThanOrEqual(fm.base);
  });

  it("returns null for unsupported output model", () => {
    expect(getOutputBudgetByOutputModel("ProjectScore")).toBeNull();
  });
});
