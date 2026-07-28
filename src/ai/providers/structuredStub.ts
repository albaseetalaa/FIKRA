import type { AIProvider, InvokeOptions } from "./interface";
import { OutputModelName } from "../types/outputs";

type StubMode = "valid" | "invalid" | "malformed" | "empty" | "timeout" | "rate_limit" | "error";

export interface StubOptions extends InvokeOptions {
  mode?: StubMode;
  agentId?: string;
  outputModel?: OutputModelName;
}

function nowISO() {
  return new Date().toISOString();
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function amount(value: number, currency = "USD", period: "one_time" | "monthly" | "annual" = "monthly") {
  return {
    amount: value,
    currency,
    period,
    estimateStatus: "estimated" as const,
    sourceType: "model_assumption" as const,
    confidence: 0.55,
    assumptions: ["Deterministic structured stub output for local/testing flows."],
  };
}

function provenance() {
  return {
    assumptions: ["Structured stub output."],
    missingInputs: ["verified_market_dataset"],
    confidenceLevel: 0.55,
    evidenceSummary: ["Stub-generated assumptions for local development."],
    generatedAt: nowISO(),
    contextVersion: "1.0.0",
    verticalTemplateVersion: "1.0.0",
    modelProvider: "structured-stub",
    modelName: "structured-stub-default",
    sourceClassification: "model_assumption" as const,
  };
}

const StructuredStubProvider: AIProvider = {
  id: "structured-stub",
  name: "Structured Stub Provider",
  invoke: async (prompt: string, options?: StubOptions) => {
    const mode: StubMode = (options?.mode as StubMode) ?? (process.env.STRUCTURED_STUB_MODE as StubMode) ?? "valid";
    const agentId = options?.agentId as string | undefined;
    const outputModel = options?.outputModel as OutputModelName | undefined;

    // Simulate different failure modes
    if (mode === "timeout") {
      throw new Error("TIMEOUT");
    }
    if (mode === "rate_limit") {
      const error = new Error("RATE_LIMIT");
      (error as { code?: string }).code = "RATE_LIMIT";
      throw error;
    }
    if (mode === "error") {
      throw new Error("PROVIDER_ERROR");
    }

    // Build structured outputs for supported models
    const build = (model?: OutputModelName) => {
      switch (model) {
        case "BusinessPlan":
          return {
            executiveSummary: `${agentId ?? "Project"} is focused on fast laundry pickup and delivery for busy professionals.`,
            problem: "Customers need predictable laundry logistics with low friction.",
            solution: "Provide scheduled pickup and delivery with transparent timing.",
            valueProposition: "Time savings and reliability for recurring laundry needs.",
            targetMarket: "Urban professionals and families",
            customerSegments: ["Busy professionals", "Families"],
            businessVertical: "logistics_delivery",
            revenueModel: "service_fees",
            operatingModel: "Hub-and-spoke pickup and delivery operations.",
            channels: ["mobile", "web", "referrals"],
            competitiveAdvantage: "Faster scheduling with quality-control guarantees.",
            objectives: [
              {
                id: "obj-1",
                statement: "Launch MVP service in core delivery zones",
                metric: "service_launch",
                targetValue: "3 zones",
                timeHorizon: "90 days",
              },
            ],
            milestones: [
              {
                id: "m-1",
                title: "MVP launch",
                description: "Launch operations in initial zones.",
                targetDate: addDaysIso(90),
                dateSource: "calculated_from_timeline",
                dependencies: [],
                confidence: 0.6,
                assumptions: ["Vendor onboarding completes on time."],
              },
            ],
            risks: ["Driver supply variance", "Operational quality drift"],
            ...provenance(),
          };
        case "MarketResearchReport":
          return {
            summary: "Preliminary demand signals require external validation before treated as verified evidence.",
            targetCustomers: ["Busy professionals", "Families"],
            marketSizeEstimate: "Market size not yet validated",
            trends: ["Convenience-oriented purchasing behavior", "Local delivery preference"],
            claims: [
              {
                claimId: "c-1",
                claim: "Customers value predictable pickup windows for repeat laundry usage.",
                evidenceType: "model_assumption",
                source: null,
                sourceTitle: null,
                sourceDate: null,
                methodology: "Assumption from customer-behavior proxy patterns.",
                geography: "Local urban market",
                timePeriod: "next_12_months",
                confidence: 0.5,
                validationStatus: "requires_external_research",
                generatedAt: nowISO(),
              },
            ],
            competitorDataStatus: "unavailable",
            competitors: [],
            unavailableCompetitorOutcome: {
              competitorDataStatus: "unavailable",
              competitorCategoriesToInvestigate: ["local_laundry_services", "delivery_networks"],
              requiredResearchActions: ["Map local providers", "Collect service-level data"],
              suggestedSearchQueries: ["best laundry service near me", "pickup laundry delivery pricing"],
              comparisonCriteria: ["turnaround_time", "price", "quality_assurance"],
            },
            ...provenance(),
          };
        case "CompetitorAnalysis":
          return {
            competitor: "Category incumbent",
            strengths: ["Wide coverage"],
            weaknesses: ["High prices"],
            opportunities: ["Better UX"],
          };
        case "FinancialReport":
          return {
            projectedRevenue: 1200000,
            projectedExpenses: 800000,
            cashflowSummary: "Positive after month 9",
          };
        case "FinancialModel":
          return {
            verticalId: "logistics_delivery",
            revenueModelType: "service_fees",
            revenueChannels: ["pickup_delivery", "subscription_addon"],
            startupCosts: [
              {
                id: "startup-vans",
                category: "fleet_setup",
                value: amount(22000, "USD", "one_time"),
                formula: "vehicles_count * average_vehicle_setup_cost",
                inputValues: [
                  { name: "vehicles_count", value: 4 },
                  { name: "average_vehicle_setup_cost", value: 5500 },
                ],
                sourceType: "model_assumption",
              },
            ],
            operatingCosts: [
              {
                id: "opex-payroll",
                category: "payroll",
                value: amount(18000, "USD", "monthly"),
                formula: "team_size * avg_monthly_pay",
                inputValues: [
                  { name: "team_size", value: 12 },
                  { name: "avg_monthly_pay", value: 1500 },
                ],
                sourceType: "model_assumption",
              },
            ],
            revenueDrivers: ["deliveries_per_day", "average_fee", "fleet_utilization"],
            costCategories: ["fuel", "drivers", "maintenance", "routing_software"],
            financialKPIs: ["delivery_margin", "on_time_rate"],
            pricingRecommendation: [
              {
                tier: "Per-delivery",
                recommendedPrice: amount(8, "USD", "one_time"),
                reasoning: "Simple pricing for early customer adoption.",
                targetCustomer: "Local households",
              },
            ],
            financialForecast: [
              {
                scenario: "conservative",
                monthlyRevenue: amount(22000, "USD", "monthly"),
                monthlyExpenses: amount(26000, "USD", "monthly"),
                grossProfit: amount(8000, "USD", "monthly"),
                netProfit: amount(-4000, "USD", "monthly"),
                estimatedCustomers: 350,
                assumptions: ["Lower utilization in first quarter."],
                confidence: 0.5,
              },
              {
                scenario: "expected",
                monthlyRevenue: amount(36000, "USD", "monthly"),
                monthlyExpenses: amount(29000, "USD", "monthly"),
                grossProfit: amount(15000, "USD", "monthly"),
                netProfit: amount(7000, "USD", "monthly"),
                estimatedCustomers: 520,
                assumptions: ["Moderate repeat-rate improvement."],
                confidence: 0.58,
              },
              {
                scenario: "optimistic",
                monthlyRevenue: amount(50000, "USD", "monthly"),
                monthlyExpenses: amount(34000, "USD", "monthly"),
                grossProfit: amount(22000, "USD", "monthly"),
                netProfit: amount(16000, "USD", "monthly"),
                estimatedCustomers: 720,
                assumptions: ["Higher route density and lower churn."],
                confidence: 0.46,
              },
            ],
            breakEvenAnalysis: {
              estimatedMonth: 10,
              requiredMonthlyRevenue: amount(31000, "USD", "monthly"),
              breakEvenDailyOrders: 145,
              formula: "monthly_fixed_costs / contribution_margin_per_order",
              notes: "Break-even achievable with stable mid-tier conversion.",
            },
            fundingRecommendation: {
              type: "Seed",
              reasoning: "Early traction supports seed funding for growth acceleration.",
            },
            ...provenance(),
          };
        case "ProjectScore":
          return {
            overallScore: 61,
            dimensions: [
              {
                id: "dataCompleteness",
                score: 65,
                weight: 0.2,
                weightedScore: 13,
                explanation: "Core business context exists, but verified market evidence is limited.",
                supportingEvidence: ["Business profile fields provided"],
                missingInputs: ["verified_market_dataset"],
                improvementActions: ["Add location-specific validated demand data"],
                confidence: 0.58,
              },
            ],
            calculationExplanation: "Weighted average of scoring dimensions.",
            notEnoughData: false,
            ...provenance(),
          };
        case "BrandStrategy":
          return {
            positioning: "Convenience-first local laundry service",
            values: ["Reliable", "Fast", "Careful"],
            toneOfVoice: "Friendly and professional",
          };
        case "ProjectSummary":
          return { title: "QuickClean", description: "Laundry pickup & delivery for busy people.", createdAt: nowISO() };
        default:
          return { message: "unsupported" };
      }
    };

    if (mode === "malformed") {
      return "{ not: valid json }"; // malformed
    }

    if (mode === "empty") {
      return "";
    }

    if (mode === "invalid") {
      // Return an object that does not match schema
      return { bad: "data" };
    }

    // valid
    const payload = build(outputModel);
    // sometimes providers wrap responses in extra fields; emulate that
    return { id: "resp_1", created: Date.now(), result: { output: payload } };
  },
  stream: undefined,
  health: async () => ({ ok: true }),
  models: async () => ["BusinessPlan", "MarketResearchReport", "FinancialModel", "ProjectScore", "CompetitorAnalysis", "FinancialReport", "BrandStrategy", "ProjectSummary"],
  validateConfiguration: async () => true,
};

export default StructuredStubProvider;
