import type { ProjectScore, ScoreDimension } from "../../ai/types/outputs";
import type { ProjectContext } from "../../ai/context";
import type { ArtifactRecord } from "../../ai/store/artifactStore";

function clampScore(value: number) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function buildDimension(input: {
  id: string;
  score: number;
  weight: number;
  explanation: string;
  supportingEvidence: string[];
  missingInputs: string[];
  improvementActions: string[];
  confidence: number;
}): ScoreDimension {
  const score = clampScore(input.score);
  return {
    id: input.id,
    score,
    weight: input.weight,
    weightedScore: Number((score * input.weight).toFixed(2)),
    explanation: input.explanation,
    supportingEvidence: input.supportingEvidence,
    missingInputs: input.missingInputs,
    improvementActions: input.improvementActions,
    confidence: Math.max(0, Math.min(1, input.confidence)),
  };
}

function hasArtifact(artifacts: ArtifactRecord[], outputType: string) {
  return artifacts.some((item) => item.outputType === outputType && item.validationStatus === "valid");
}

export function calculateProjectScore(input: {
  context: ProjectContext;
  artifacts: ArtifactRecord[];
  modelProvider?: string | null;
  modelName?: string | null;
  generatedAt?: string;
}): ProjectScore {
  const { context, artifacts } = input;
  const missingInputs = new Set<string>();

  if (!context.country) missingInputs.add("country");
  if (!context.currency) missingInputs.add("currency");
  if (context.businessVerticalConfidence < 0.55) missingInputs.add("business_vertical_confirmation");

  const hasBusinessPlan = hasArtifact(artifacts, "BusinessPlan");
  const hasMarket = hasArtifact(artifacts, "MarketResearchReport");
  const hasFinancial = hasArtifact(artifacts, "FinancialModel");

  const dimensions: ScoreDimension[] = [
    buildDimension({
      id: "dataCompleteness",
      score: context.currency ? (context.country ? 80 : 65) : 40,
      weight: 0.15,
      explanation: "Measures completeness of core business context fields.",
      supportingEvidence: [
        context.country ? "Country provided" : "Country missing",
        context.currency ? `Currency resolved (${context.currency})` : "Currency unresolved",
      ],
      missingInputs: context.currency ? [] : ["currency"],
      improvementActions: context.currency ? ["Refine target audience specificity"] : ["Provide explicit business currency"],
      confidence: 0.8,
    }),
    buildDimension({
      id: "problemSolutionClarity",
      score: hasBusinessPlan ? 78 : 35,
      weight: 0.15,
      explanation: "Assesses whether the plan defines coherent problem-solution framing.",
      supportingEvidence: [hasBusinessPlan ? "Business plan artifact generated" : "Business plan artifact missing"],
      missingInputs: hasBusinessPlan ? [] : ["business_plan"],
      improvementActions: ["Strengthen problem framing with customer pain points"],
      confidence: hasBusinessPlan ? 0.75 : 0.4,
    }),
    buildDimension({
      id: "marketEvidence",
      score: hasMarket ? 66 : 28,
      weight: 0.12,
      explanation: "Evaluates quality and availability of structured market evidence.",
      supportingEvidence: [hasMarket ? "Market research artifact generated" : "Market research artifact missing"],
      missingInputs: hasMarket ? [] : ["market_evidence"],
      improvementActions: ["Add externally validated market data sources"],
      confidence: hasMarket ? 0.65 : 0.35,
    }),
    buildDimension({
      id: "differentiation",
      score: hasBusinessPlan ? 70 : 30,
      weight: 0.1,
      explanation: "Checks whether competitive advantage and positioning are explicit.",
      supportingEvidence: [hasBusinessPlan ? "Competitive advantage declared" : "No validated strategy artifact"],
      missingInputs: hasBusinessPlan ? [] : ["value_proposition"],
      improvementActions: ["Add competitor gap analysis"],
      confidence: hasBusinessPlan ? 0.7 : 0.35,
    }),
    buildDimension({
      id: "businessModelCoherence",
      score: context.revenueModelType === "unknown" ? 35 : 76,
      weight: 0.16,
      explanation: "Checks alignment between business vertical and revenue model.",
      supportingEvidence: [
        `Vertical=${context.businessVertical}`,
        `RevenueModel=${context.revenueModelType}`,
      ],
      missingInputs: context.revenueModelType === "unknown" ? ["revenue_model_confirmation"] : [],
      improvementActions: ["Confirm channel-level monetization assumptions"],
      confidence: Math.max(0.35, context.businessVerticalConfidence),
    }),
    buildDimension({
      id: "financialReadiness",
      score: hasFinancial ? 72 : 24,
      weight: 0.14,
      explanation: "Evaluates completeness of financial scenario and break-even modeling.",
      supportingEvidence: [hasFinancial ? "Financial model artifact generated" : "Financial model artifact missing"],
      missingInputs: hasFinancial ? [] : ["financial_model"],
      improvementActions: ["Add verified cost anchors and sensitivity analysis"],
      confidence: hasFinancial ? 0.7 : 0.3,
    }),
    buildDimension({
      id: "executionReadiness",
      score: hasBusinessPlan && hasMarket && hasFinancial ? 74 : 45,
      weight: 0.1,
      explanation: "Assesses readiness to execute based on strategy, research, and finance completeness.",
      supportingEvidence: [
        hasBusinessPlan ? "Strategy complete" : "Strategy incomplete",
        hasMarket ? "Market research complete" : "Market research incomplete",
        hasFinancial ? "Financial model complete" : "Financial model incomplete",
      ],
      missingInputs: hasBusinessPlan && hasMarket && hasFinancial ? [] : ["complete_core_artifacts"],
      improvementActions: ["Confirm timeline and operational assumptions"],
      confidence: 0.68,
    }),
    buildDimension({
      id: "riskPreparedness",
      score: hasBusinessPlan ? 64 : 32,
      weight: 0.08,
      explanation: "Evaluates explicit risk and mitigation preparedness.",
      supportingEvidence: [hasBusinessPlan ? "Risk section expected in strategy" : "No strategy artifact"],
      missingInputs: hasBusinessPlan ? [] : ["risk_register"],
      improvementActions: ["Add quantified risk mitigation actions"],
      confidence: hasBusinessPlan ? 0.62 : 0.3,
    }),
  ];

  const weightedTotal = dimensions.reduce((sum, dimension) => sum + dimension.weightedScore, 0);
  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const enoughData = hasBusinessPlan || hasMarket || hasFinancial;

  const overallScore = enoughData && totalWeight > 0
    ? clampScore(weightedTotal / totalWeight)
    : null;

  return {
    overallScore,
    dimensions,
    calculationExplanation: "Overall score is the weighted average of score dimensions. Each dimension includes evidence, missing inputs, and improvement actions.",
    notEnoughData: !enoughData,
    assumptions: [
      "Score quality depends on artifact completeness and context confidence.",
      "Unverified market evidence reduces confidence.",
    ],
    missingInputs: Array.from(missingInputs),
    confidenceLevel: enoughData ? 0.68 : 0.3,
    evidenceSummary: [
      hasBusinessPlan ? "Business plan available" : "Business plan missing",
      hasMarket ? "Market research available" : "Market research missing",
      hasFinancial ? "Financial model available" : "Financial model missing",
    ],
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    contextVersion: context.contextVersion,
    verticalTemplateVersion: "1.0.0",
    modelProvider: input.modelProvider ?? null,
    modelName: input.modelName ?? null,
    sourceClassification: "calculated_estimate",
  };
}
