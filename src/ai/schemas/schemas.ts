import { z } from "zod";
import { OutputModelName } from "../types/outputs";
import {
  COMPETITOR_DATA_STATUSES,
  EVIDENCE_TYPES,
  EVIDENCE_VALIDATION_STATUSES,
  SOURCE_CLASSIFICATIONS,
} from "../contracts/outputContracts";

const sourceClassificationSchema = z.enum(SOURCE_CLASSIFICATIONS);

const confidenceLevelSchema = z.number().min(0).max(1);

const provenanceFieldsSchema = z.object({
  assumptions: z.array(z.string()).max(20),
  missingInputs: z.array(z.string()).max(20),
  confidenceLevel: confidenceLevelSchema,
  evidenceSummary: z.array(z.string()).max(20),
  generatedAt: z.string(),
  contextVersion: z.string(),
  verticalTemplateVersion: z.string(),
  modelProvider: z.string().nullable(),
  modelName: z.string().nullable(),
  sourceClassification: sourceClassificationSchema,
});

const milestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  targetDate: z.string(),
  dateSource: z.enum(["user_provided", "calculated_from_timeline", "model_assumption"]),
  dependencies: z.array(z.string()),
  confidence: confidenceLevelSchema,
  assumptions: z.array(z.string()),
});

const objectiveSchema = z.object({
  id: z.string(),
  statement: z.string(),
  metric: z.string(),
  targetValue: z.string(),
  timeHorizon: z.string(),
});

export const BusinessPlanSchema = z.object({
  businessName: z.string(),
  country: z.string(),
  city: z.string().nullable(),
  currency: z.string().length(3).nullable(),
  businessStage: z.string(),
  executiveSummary: z.string(),
  problem: z.string(),
  solution: z.string(),
  valueProposition: z.string(),
  targetMarket: z.string(),
  customerSegments: z.array(z.string()),
  businessVertical: z.string(),
  primaryRevenueModel: z.string(),
  secondaryRevenueModels: z.array(z.string()).max(10),
  operatingModel: z.string(),
  salesChannels: z.array(z.string()).max(15),
  revenueComponents: z.array(z.string()).max(20),
  competitiveAdvantage: z.string(),
  objectives: z.array(objectiveSchema),
  milestones: z.array(milestoneSchema),
  risks: z.array(z.string()),
  projectCreatedAt: z.string().optional(),
}).merge(provenanceFieldsSchema);

const evidenceValidationStatusSchema = z.enum(EVIDENCE_VALIDATION_STATUSES);

const marketClaimSchema = z.object({
  claimId: z.string(),
  claim: z.string(),
  evidenceType: z.enum(EVIDENCE_TYPES),
  source: z.string().nullable(),
  sourceTitle: z.string().nullable(),
  sourceDate: z.string().nullable(),
  methodology: z.string(),
  geography: z.string(),
  timePeriod: z.string(),
  confidence: confidenceLevelSchema,
  validationStatus: evidenceValidationStatusSchema,
  generatedAt: z.string(),
});

const competitorEvidenceSchema = z.object({
  sourceType: sourceClassificationSchema,
  sourceTitle: z.string().nullable(),
  validationStatus: evidenceValidationStatusSchema,
});

const verifiedCompetitorSchema = z.object({
  name: z.string(),
  geography: z.string(),
  category: z.string(),
  targetCustomer: z.string(),
  offering: z.string(),
  pricePosition: z.string(),
  whyItCompetes: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  evidence: competitorEvidenceSchema,
  validationStatus: evidenceValidationStatusSchema,
});

export const MarketResearchReportSchema = z.object({
  summary: z.string(),
  targetCustomers: z.array(z.string()),
  marketSizeEstimate: z.string(),
  trends: z.array(z.string()),
  claims: z.array(marketClaimSchema),
  competitorDataStatus: z.enum(COMPETITOR_DATA_STATUSES),
  competitors: z.array(verifiedCompetitorSchema),
  unavailableCompetitorOutcome: z
    .object({
      competitorDataStatus: z.literal("unavailable"),
      competitorCategoriesToInvestigate: z.array(z.string()),
      requiredResearchActions: z.array(z.string()),
      suggestedSearchQueries: z.array(z.string()),
      comparisonCriteria: z.array(z.string()),
    })
    .nullable(),
}).merge(provenanceFieldsSchema);

export const CompetitorAnalysisSchema = z.object({
  competitor: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  opportunities: z.array(z.string()),
});

export const FinancialReportSchema = z.object({
  projectedRevenue: z.number(),
  projectedExpenses: z.number(),
  cashflowSummary: z.string(),
});

const FinancialForecastScenarioSchema = z.object({
  scenario: z.enum(["conservative", "expected", "optimistic"]),
  monthlyRevenue: z.object({
    amount: z.number(),
    currency: z.string().length(3),
    period: z.enum(["one_time", "monthly", "annual"]),
    estimateStatus: z.enum(["estimated", "user_provided", "calculated"]),
    sourceType: sourceClassificationSchema,
    confidence: confidenceLevelSchema,
    assumptions: z.array(z.string()),
  }),
  monthlyExpenses: z.object({
    amount: z.number(),
    currency: z.string().length(3),
    period: z.enum(["one_time", "monthly", "annual"]),
    estimateStatus: z.enum(["estimated", "user_provided", "calculated"]),
    sourceType: sourceClassificationSchema,
    confidence: confidenceLevelSchema,
    assumptions: z.array(z.string()),
  }),
  grossProfit: z.object({
    amount: z.number(),
    currency: z.string().length(3),
    period: z.enum(["one_time", "monthly", "annual"]),
    estimateStatus: z.enum(["estimated", "user_provided", "calculated"]),
    sourceType: sourceClassificationSchema,
    confidence: confidenceLevelSchema,
    assumptions: z.array(z.string()),
  }),
  netProfit: z.object({
    amount: z.number(),
    currency: z.string().length(3),
    period: z.enum(["one_time", "monthly", "annual"]),
    estimateStatus: z.enum(["estimated", "user_provided", "calculated"]),
    sourceType: sourceClassificationSchema,
    confidence: confidenceLevelSchema,
    assumptions: z.array(z.string()),
  }),
  estimatedCustomers: z.number(),
  assumptions: z.array(z.string()),
  confidence: confidenceLevelSchema,
});

const monetaryValueSchema = z.object({
  amount: z.number(),
  currency: z.string().length(3),
  period: z.enum(["one_time", "monthly", "annual"]),
  estimateStatus: z.enum(["estimated", "user_provided", "calculated"]),
  sourceType: sourceClassificationSchema,
  confidence: confidenceLevelSchema,
  assumptions: z.array(z.string()),
});

const financialLineItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  value: monetaryValueSchema,
  formula: z.string(),
  inputValues: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
    }),
  ),
  sourceType: sourceClassificationSchema,
});

export const FinancialModelSchema = z.object({
  verticalId: z.string(),
  revenueModelType: z.string(),
  revenueChannels: z.array(z.string()).max(10),
  startupCosts: z.array(financialLineItemSchema).max(15),
  operatingCosts: z.array(financialLineItemSchema).max(20),
  revenueDrivers: z.array(z.string()).max(20),
  costCategories: z.array(z.string()).max(20),
  financialKPIs: z.array(z.string()).max(20),
  revenueModel: z.object({
    type: z.enum(["Subscription", "Marketplace", "Licensing", "One-time Purchase", "Commission", "Hybrid"]),
    reasoning: z.string(),
  }).optional(),
  pricingRecommendation: z.array(
    z.object({
      tier: z.string(),
      recommendedPrice: monetaryValueSchema,
      reasoning: z.string(),
      targetCustomer: z.string(),
    }),
  ).max(6),
  financialForecast: z.array(FinancialForecastScenarioSchema).length(3),
  breakEvenAnalysis: z.object({
    estimatedMonth: z.number(),
    requiredMonthlyRevenue: monetaryValueSchema,
    breakEvenDailyOrders: z.number().nullable(),
    formula: z.string(),
    notes: z.string(),
  }),
  fundingRecommendation: z.object({
    type: z.enum(["Bootstrap", "Angel", "Seed", "VC", "Crowdfunding"]),
    reasoning: z.string(),
  }),
}).merge(provenanceFieldsSchema);

export const ProjectScoreSchema = z.object({
  overallScore: z.number().min(0).max(100).nullable(),
  dimensions: z.array(
    z.object({
      id: z.string(),
      score: z.number().min(0).max(100),
      weight: z.number().min(0),
      weightedScore: z.number().min(0),
      explanation: z.string(),
      supportingEvidence: z.array(z.string()),
      missingInputs: z.array(z.string()),
      improvementActions: z.array(z.string()),
      confidence: confidenceLevelSchema,
    }),
  ),
  calculationExplanation: z.string(),
  notEnoughData: z.boolean(),
}).merge(provenanceFieldsSchema);

export const ExecutionPlanSchema = z.object({
  workflowId: z.string(),
  selectedAgents: z.array(z.string()),
  executionOrder: z.array(z.string()),
  dependencyGraph: z.record(z.array(z.string())),
  reasoning: z.array(z.string()),
  expectedArtifacts: z.array(z.string()),
  currentStatus: z.enum(["planning", "running", "retrying", "waiting_for_user", "completed", "failed", "cancelled"]),
});

export const BrandStrategySchema = z.object({
  positioning: z.string(),
  values: z.array(z.string()),
  toneOfVoice: z.string(),
});

export const LogoConceptSchema = z.object({
  concept: z.string(),
  colorPalette: z.array(z.string()),
  variations: z.array(z.string()),
});

export const VisualIdentitySchema = z.object({
  colorPalette: z.array(z.string()),
  typography: z.string(),
  guidelines: z.string(),
});

export const WebsiteStructureSchema = z.object({
  pages: z.array(z.object({ path: z.string(), title: z.string(), purpose: z.string() })),
  sitemap: z.array(z.string()),
});

export const MarketingPlanSchema = z.object({
  channels: z.array(z.string()),
  budgetAllocation: z.record(z.number()),
  timeline: z.array(z.object({ task: z.string(), date: z.string().optional() })),
});

export const OperationsPlanSchema = z.object({
  teamStructure: z.record(z.string()),
  processes: z.array(z.string()),
});

export const PitchDeckSchema = z.object({
  slides: z.array(z.object({ title: z.string(), content: z.string() })),
});

export const GrowthRoadmapSchema = z.object({
  initiatives: z.array(z.object({ name: z.string(), impact: z.string(), quarter: z.string() })),
});

export const ProjectSummarySchema = z.object({
  title: z.string(),
  description: z.string(),
  createdAt: z.string(),
});

export const schemas: Record<OutputModelName, z.ZodTypeAny> = {
  BusinessPlan: BusinessPlanSchema,
  MarketResearchReport: MarketResearchReportSchema,
  CompetitorAnalysis: CompetitorAnalysisSchema,
  FinancialReport: FinancialReportSchema,
  FinancialModel: FinancialModelSchema,
  ProjectScore: ProjectScoreSchema,
  ExecutionPlan: ExecutionPlanSchema,
  BrandStrategy: BrandStrategySchema,
  LogoConcept: LogoConceptSchema,
  VisualIdentity: VisualIdentitySchema,
  WebsiteStructure: WebsiteStructureSchema,
  MarketingPlan: MarketingPlanSchema,
  OperationsPlan: OperationsPlanSchema,
  PitchDeck: PitchDeckSchema,
  GrowthRoadmap: GrowthRoadmapSchema,
  ProjectSummary: ProjectSummarySchema,
};

export default schemas;
