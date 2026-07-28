import { BusinessPlan, FinancialModel, MarketResearchReport } from "../types/outputs";

const generatedAt = "2026-07-28T00:00:00.000Z";

function provenance() {
  return {
    assumptions: ["Fixture assumption"],
    missingInputs: [],
    confidenceLevel: 0.75,
    evidenceSummary: ["Fixture evidence summary"],
    generatedAt,
    contextVersion: "1.0.0",
    verticalTemplateVersion: "1.0.0",
    modelProvider: "mock",
    modelName: "fixture-model",
    sourceClassification: "model_assumption" as const,
  };
}

export const validBusinessPlan: BusinessPlan = {
  businessName: "Eggreen",
  country: "Jordan",
  city: "Amman",
  currency: "JOD",
  businessStage: "planning",
  executiveSummary: "A concise summary",
  problem: "Customers need convenient healthy breakfast options.",
  solution: "Fast healthy egg-based breakfast with multiple fulfillment channels.",
  valueProposition: "Healthy breakfast delivered quickly and consistently.",
  targetMarket: "Small businesses in MENA",
  customerSegments: ["Young professionals", "Students"],
  businessVertical: "restaurant_food_service",
  primaryRevenueModel: "transaction_sales",
  secondaryRevenueModels: [],
  operatingModel: "Store operations plus delivery aggregation",
  salesChannels: ["dine_in", "takeaway", "drive_thru", "delivery"],
  revenueComponents: ["transaction_sales", "delivery_fee", "add_on_products"],
  competitiveAdvantage: "Specialized healthy breakfast positioning",
  objectives: [
    {
      id: "obj-1",
      statement: "Reach 120 orders/day",
      metric: "daily_orders",
      targetValue: "120",
      timeHorizon: "6 months",
    },
  ],
  milestones: [
    {
      id: "ms-1",
      title: "Launch location one",
      description: "Open first location",
      targetDate: "2026-09-01",
      dateSource: "calculated_from_timeline",
      dependencies: [],
      confidence: 0.8,
      assumptions: ["Permit process stays on schedule."],
    },
  ],
  risks: ["Ingredient cost volatility"],
  projectCreatedAt: "2026-07-28T00:00:00.000Z",
  ...provenance(),
};

export const invalidBusinessPlan = {
  // missing executiveSummary and milestones wrong type
  objectives: "should be array",
  targetMarket: 123,
};

export const validMarketResearchReport: MarketResearchReport = {
  summary: "Market is growing",
  targetCustomers: ["SMBs", "Startups"],
  marketSizeEstimate: "Market size not yet validated",
  trends: ["Demand for convenient healthy meals"],
  claims: [
    {
      claimId: "claim-1",
      claim: "Office workers prefer convenient healthy breakfast options.",
      evidenceType: "model_assumption",
      source: null,
      sourceTitle: null,
      sourceDate: null,
      methodology: "Proxy assumption based on customer interviews pending validation.",
      geography: "Amman",
      timePeriod: "next_12_months",
      confidence: 0.62,
      validationStatus: "requires_external_research",
      generatedAt,
    },
  ],
  competitorDataStatus: "unavailable",
  competitors: [],
  unavailableCompetitorOutcome: {
    competitorDataStatus: "unavailable",
    competitorCategoriesToInvestigate: ["quick_service_restaurants", "delivery_kitchens"],
    requiredResearchActions: ["Field mapping", "Menu/price comparison"],
    suggestedSearchQueries: ["best breakfast restaurant amman", "healthy breakfast delivery amman"],
    comparisonCriteria: ["price", "speed", "menu_quality"],
  },
  ...provenance(),
};

export const malformedResponse = "{ not: valid json }";

export const missingFields = { executiveSummary: "Exists" };

export const validFinancialModel: FinancialModel = {
  verticalId: "restaurant_food_service",
  revenueModelType: "transaction_sales",
  revenueChannels: ["dine_in", "takeaway", "delivery"],
  startupCosts: [
    {
      id: "startup-1",
      category: "kitchen_equipment",
      value: {
        amount: 40000,
        currency: "JOD",
        period: "one_time",
        estimateStatus: "estimated",
        sourceType: "model_assumption",
        confidence: 0.72,
        assumptions: ["Equipment sourced locally."],
      },
      formula: "units * average_unit_cost",
      inputValues: [
        { name: "units", value: 10 },
        { name: "average_unit_cost", value: 4000 },
      ],
      sourceType: "model_assumption",
    },
  ],
  operatingCosts: [
    {
      id: "opex-1",
      category: "payroll",
      value: {
        amount: 22000,
        currency: "JOD",
        period: "monthly",
        estimateStatus: "estimated",
        sourceType: "model_assumption",
        confidence: 0.7,
        assumptions: ["Initial staffing plan."],
      },
      formula: "headcount * avg_salary",
      inputValues: [
        { name: "headcount", value: 14 },
        { name: "avg_salary", value: 1571 },
      ],
      sourceType: "model_assumption",
    },
  ],
  revenueDrivers: ["average_order_value", "daily_transactions", "operating_days_per_month", "channel_mix"],
  costCategories: ["rent", "payroll", "ingredients", "food_cost", "packaging", "delivery_commissions"],
  financialKPIs: ["gross_margin", "break_even_daily_orders"],
  pricingRecommendation: [
    {
      tier: "Classic meal",
      recommendedPrice: {
        amount: 6.5,
        currency: "JOD",
        period: "one_time",
        estimateStatus: "estimated",
        sourceType: "model_assumption",
        confidence: 0.67,
        assumptions: ["Comparable local menu pricing."],
      },
      reasoning: "Anchored to neighborhood affordability expectations.",
      targetCustomer: "Office workers",
    },
  ],
  financialForecast: [
    {
      scenario: "conservative",
      monthlyRevenue: { amount: 18000, currency: "JOD", period: "monthly", estimateStatus: "estimated", sourceType: "model_assumption", confidence: 0.6, assumptions: ["Lower order volume"] },
      monthlyExpenses: { amount: 22000, currency: "JOD", period: "monthly", estimateStatus: "estimated", sourceType: "model_assumption", confidence: 0.6, assumptions: ["Baseline staffing"] },
      grossProfit: { amount: 9000, currency: "JOD", period: "monthly", estimateStatus: "calculated", sourceType: "calculated_estimate", confidence: 0.6, assumptions: ["COGS ratio"] },
      netProfit: { amount: -4000, currency: "JOD", period: "monthly", estimateStatus: "calculated", sourceType: "calculated_estimate", confidence: 0.6, assumptions: ["Fixed costs"] },
      estimatedCustomers: 30,
      assumptions: ["Early-stage throughput"],
      confidence: 0.6,
    },
    {
      scenario: "expected",
      monthlyRevenue: { amount: 42000, currency: "JOD", period: "monthly", estimateStatus: "estimated", sourceType: "model_assumption", confidence: 0.72, assumptions: ["Planned channel mix"] },
      monthlyExpenses: { amount: 32000, currency: "JOD", period: "monthly", estimateStatus: "estimated", sourceType: "model_assumption", confidence: 0.72, assumptions: ["Planned team"] },
      grossProfit: { amount: 24000, currency: "JOD", period: "monthly", estimateStatus: "calculated", sourceType: "calculated_estimate", confidence: 0.72, assumptions: ["Stable food-cost ratio"] },
      netProfit: { amount: 10000, currency: "JOD", period: "monthly", estimateStatus: "calculated", sourceType: "calculated_estimate", confidence: 0.72, assumptions: ["Operating leverage"] },
      estimatedCustomers: 70,
      assumptions: ["Expected demand realization"],
      confidence: 0.72,
    },
    {
      scenario: "optimistic",
      monthlyRevenue: { amount: 76000, currency: "JOD", period: "monthly", estimateStatus: "estimated", sourceType: "model_assumption", confidence: 0.55, assumptions: ["Higher repeat usage"] },
      monthlyExpenses: { amount: 41000, currency: "JOD", period: "monthly", estimateStatus: "estimated", sourceType: "model_assumption", confidence: 0.55, assumptions: ["Expanded staffing"] },
      grossProfit: { amount: 46000, currency: "JOD", period: "monthly", estimateStatus: "calculated", sourceType: "calculated_estimate", confidence: 0.55, assumptions: ["Optimistic mix"] },
      netProfit: { amount: 35000, currency: "JOD", period: "monthly", estimateStatus: "calculated", sourceType: "calculated_estimate", confidence: 0.55, assumptions: ["Margin expansion"] },
      estimatedCustomers: 120,
      assumptions: ["Optimistic channel growth"],
      confidence: 0.55,
    },
  ],
  breakEvenAnalysis: {
    estimatedMonth: 10,
    requiredMonthlyRevenue: {
      amount: 36000,
      currency: "JOD",
      period: "monthly",
      estimateStatus: "calculated",
      sourceType: "calculated_estimate",
      confidence: 0.7,
      assumptions: ["Contribution margin assumptions"],
    },
    breakEvenDailyOrders: 95,
    formula: "fixed_monthly_costs / contribution_margin_per_order",
    notes: "Requires stable conversion at mid-tier pricing.",
  },
  fundingRecommendation: {
    type: "Seed",
    reasoning: "Seed capital accelerates channel expansion and hiring.",
  },
  ...provenance(),
};

const mocks = { validBusinessPlan, invalidBusinessPlan, validMarketResearchReport, validFinancialModel, malformedResponse, missingFields };

export default mocks;
