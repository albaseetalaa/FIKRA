export interface BusinessPlan {
  executiveSummary: string;
  objectives: string[];
  targetMarket: string;
  revenueModel: string;
  milestones: Array<{ title: string; dueDate?: string }>;
}

export interface MarketResearch {
  summary: string;
  targetCustomers: string[];
  marketSizeEstimate: string;
  trends: string[];
  competitors: string[];
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
  | "MarketResearch"
  | "CompetitorAnalysis"
  | "FinancialReport"
  | "BrandStrategy"
  | "LogoConcept"
  | "VisualIdentity"
  | "WebsiteStructure"
  | "MarketingPlan"
  | "OperationsPlan"
  | "PitchDeck"
  | "GrowthRoadmap"
  | "ProjectSummary";
