import type { WorkflowStatus } from "../workflow/stateMachine";
import type { BusinessVertical, RevenueComponent, RevenueModel, SalesChannel } from "../context";
import {
  COMPETITOR_DATA_STATUSES,
  EVIDENCE_TYPES,
  EVIDENCE_VALIDATION_STATUSES,
  SOURCE_CLASSIFICATIONS,
} from "../contracts/outputContracts";

export type SourceClassification = typeof SOURCE_CLASSIFICATIONS[number];

export type EvidenceType = typeof EVIDENCE_TYPES[number];

export type EvidenceValidationStatus = typeof EVIDENCE_VALIDATION_STATUSES[number];

export type ConfidenceLevel = number;

export interface ProvenanceFields {
  assumptions: string[];
  missingInputs: string[];
  confidenceLevel: ConfidenceLevel;
  evidenceSummary: string[];
  generatedAt: string;
  contextVersion: string;
  verticalTemplateVersion: string;
  modelProvider: string | null;
  modelName: string | null;
  sourceClassification: SourceClassification;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  dateSource: "user_provided" | "calculated_from_timeline" | "model_assumption";
  dependencies: string[];
  confidence: ConfidenceLevel;
  assumptions: string[];
}

export interface Objective {
  id: string;
  statement: string;
  metric: string;
  targetValue: string;
  timeHorizon: string;
}

export interface BusinessPlan extends ProvenanceFields {
  businessName: string;
  country: string;
  city: string | null;
  currency: string | null;
  businessStage: string;
  executiveSummary: string;
  problem: string;
  solution: string;
  valueProposition: string;
  targetMarket: string;
  customerSegments: string[];
  businessVertical: BusinessVertical;
  primaryRevenueModel: RevenueModel;
  secondaryRevenueModels: RevenueModel[];
  operatingModel: string;
  salesChannels: SalesChannel[];
  revenueComponents: RevenueComponent[];
  competitiveAdvantage: string;
  objectives: Objective[];
  milestones: Milestone[];
  risks: string[];
  projectCreatedAt?: string;
}

export interface MarketClaim {
  claimId: string;
  claim: string;
  evidenceType: EvidenceType;
  source: string | null;
  sourceTitle: string | null;
  sourceDate: string | null;
  methodology: string;
  geography: string;
  timePeriod: string;
  confidence: ConfidenceLevel;
  validationStatus: EvidenceValidationStatus;
  generatedAt: string;
}

export interface CompetitorEvidence {
  sourceType: EvidenceType;
  sourceTitle: string | null;
  validationStatus: EvidenceValidationStatus;
}

export interface VerifiedCompetitorEntry {
  name: string;
  geography: string;
  category: string;
  targetCustomer: string;
  offering: string;
  pricePosition: string;
  whyItCompetes: string;
  strengths: string[];
  weaknesses: string[];
  evidence: CompetitorEvidence;
  validationStatus: EvidenceValidationStatus;
}

export interface UnavailableCompetitorOutcome {
  competitorDataStatus: "unavailable";
  competitorCategoriesToInvestigate: string[];
  requiredResearchActions: string[];
  suggestedSearchQueries: string[];
  comparisonCriteria: string[];
}

export interface MarketResearchReport extends ProvenanceFields {
  summary: string;
  targetCustomers: string[];
  marketSizeEstimate: string;
  trends: string[];
  claims: MarketClaim[];
  competitorDataStatus: typeof COMPETITOR_DATA_STATUSES[number];
  competitors: VerifiedCompetitorEntry[];
  unavailableCompetitorOutcome: UnavailableCompetitorOutcome | null;
}

export interface CompetitorAnalysis {
  competitor: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
}

export interface FinancialReport {
  projectedRevenue: number;
  projectedExpenses: number;
  cashflowSummary: string;
}

export type RevenueModelType = "Subscription" | "Marketplace" | "Licensing" | "One-time Purchase" | "Commission" | "Hybrid";
export type FundingType = "Bootstrap" | "Angel" | "Seed" | "VC" | "Crowdfunding";

export interface MonetaryValue {
  amount: number;
  currency: string;
  period: "one_time" | "monthly" | "annual";
  estimateStatus: "estimated" | "user_provided" | "calculated";
  sourceType: EvidenceType;
  confidence: ConfidenceLevel;
  assumptions: string[];
}

export interface FinancialLineItem {
  id: string;
  category: string;
  value: MonetaryValue;
  formula: string;
  inputValues: Array<{
    name: string;
    value: number;
  }>;
  sourceType: EvidenceType;
}

export interface FinancialScenario {
  scenario: "conservative" | "expected" | "optimistic";
  monthlyRevenue: MonetaryValue;
  monthlyExpenses: MonetaryValue;
  grossProfit: MonetaryValue;
  netProfit: MonetaryValue;
  estimatedCustomers: number;
  assumptions: string[];
  confidence: ConfidenceLevel;
}

export interface FinancialModel extends ProvenanceFields {
  verticalId: BusinessVertical;
  revenueModelType: RevenueModel;
  revenueChannels: string[];
  startupCosts: FinancialLineItem[];
  operatingCosts: FinancialLineItem[];
  revenueDrivers: string[];
  costCategories: string[];
  financialKPIs: string[];
  pricingRecommendation: Array<{
    tier: string;
    recommendedPrice: MonetaryValue;
    reasoning: string;
    targetCustomer: string;
  }>;
  financialForecast: FinancialScenario[];
  breakEvenAnalysis: {
    estimatedMonth: number;
    requiredMonthlyRevenue: MonetaryValue;
    breakEvenDailyOrders: number | null;
    formula: string;
    notes: string;
  };
  fundingRecommendation: {
    type: FundingType;
    reasoning: string;
  };
}

export interface ScoreDimension {
  id: string;
  score: number;
  weight: number;
  weightedScore: number;
  explanation: string;
  supportingEvidence: string[];
  missingInputs: string[];
  improvementActions: string[];
  confidence: ConfidenceLevel;
}

export interface ProjectScore extends ProvenanceFields {
  overallScore: number | null;
  dimensions: ScoreDimension[];
  calculationExplanation: string;
  notEnoughData: boolean;
}

export interface ExecutionPlan {
  workflowId: string;
  selectedAgents: string[];
  executionOrder: string[];
  dependencyGraph: Record<string, string[]>;
  reasoning: string[];
  expectedArtifacts: string[];
  currentStatus: WorkflowStatus;
}

export interface BrandStrategy {
  positioning: string;
  values: string[];
  toneOfVoice: string;
}

export interface LogoConcept {
  concept: string;
  colorPalette: string[];
  variations: string[];
}

export interface WebsiteStructure {
  pages: Array<{ path: string; title: string; purpose: string }>;
  sitemap: string[];
}

export interface MarketingPlan {
  channels: string[];
  budgetAllocation: Record<string, number>;
  timeline: Array<{ task: string; date?: string }>;
}

export interface OperationsPlan {
  teamStructure: Record<string, string>;
  processes: string[];
}

export interface PitchDeck {
  slides: Array<{ title: string; content: string }>;
}

export interface GrowthRoadmap {
  initiatives: Array<{ name: string; impact: string; quarter: string }>;
}

export type OutputModelName =
  | "BusinessPlan"
  | "MarketResearchReport"
  | "CompetitorAnalysis"
  | "FinancialReport"
  | "FinancialModel"
  | "ProjectScore"
  | "ExecutionPlan"
  | "BrandStrategy"
  | "LogoConcept"
  | "VisualIdentity"
  | "WebsiteStructure"
  | "MarketingPlan"
  | "OperationsPlan"
  | "PitchDeck"
  | "GrowthRoadmap"
  | "ProjectSummary";
