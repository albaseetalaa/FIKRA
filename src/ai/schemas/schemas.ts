import { z } from "zod";
import { OutputModelName } from "../types/outputs";

export const BusinessPlanSchema = z.object({
  executiveSummary: z.string(),
  objectives: z.array(z.string()),
  targetMarket: z.string(),
  revenueModel: z.string(),
  milestones: z.array(z.object({ title: z.string(), dueDate: z.string().optional() })),
});

export const MarketResearchSchema = z.object({
  summary: z.string(),
  targetCustomers: z.array(z.string()),
  marketSizeEstimate: z.string(),
  trends: z.array(z.string()),
  competitors: z.array(z.string()),
});

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
  MarketResearch: MarketResearchSchema,
  CompetitorAnalysis: CompetitorAnalysisSchema,
  FinancialReport: FinancialReportSchema,
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
