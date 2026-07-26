import { BusinessPlan, MarketResearch } from "../types/outputs";

export const validBusinessPlan: BusinessPlan = {
  executiveSummary: "A concise summary",
  objectives: ["Launch MVP", "Acquire 1k users"],
  targetMarket: "Small businesses in MENA",
  revenueModel: "Subscription",
  milestones: [{ title: "MVP", dueDate: "2026-09-01" }],
};

export const invalidBusinessPlan = {
  // missing executiveSummary and milestones wrong type
  objectives: "should be array",
  targetMarket: 123,
};

export const validMarketResearch: MarketResearch = {
  summary: "Market is growing",
  targetCustomers: ["SMBs", "Startups"],
  marketSizeEstimate: "1B",
  trends: ["Digital adoption"],
  competitors: ["Competitor A"],
};

export const malformedResponse = "{ not: valid json }";

export const missingFields = { executiveSummary: "Exists" };

const mocks = { validBusinessPlan, invalidBusinessPlan, validMarketResearch, malformedResponse, missingFields };

export default mocks;
