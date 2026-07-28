import type { ArtifactRecord } from "../../ai/store/artifactStore";

export type CapabilityStatus =
  | "available"
  | "generated"
  | "selected_but_not_available"
  | "coming_soon"
  | "failed"
  | "blocked"
  | "not_selected";

export interface CapabilityDescriptor {
  id: string;
  displayName: string;
  description: string;
  availability: "implemented" | "coming_soon";
  requiredAgent: string | null;
  requiredDependencies: string[];
  producedArtifactTypes: string[];
}

export interface CapabilityView extends CapabilityDescriptor {
  status: CapabilityStatus;
  selectedByUser: boolean;
  generatedArtifactIds: string[];
}

const capabilities: CapabilityDescriptor[] = [
  {
    id: "business_plan",
    displayName: "Business Plan",
    description: "Core business strategy and milestones",
    availability: "implemented",
    requiredAgent: "business_strategist",
    requiredDependencies: [],
    producedArtifactTypes: ["BusinessPlan"],
  },
  {
    id: "market_research",
    displayName: "Market Research",
    description: "Market evidence, customers, and trends",
    availability: "implemented",
    requiredAgent: "market_research",
    requiredDependencies: ["business_plan"],
    producedArtifactTypes: ["MarketResearchReport"],
  },
  {
    id: "competitor_analysis",
    displayName: "Competitor Analysis",
    description: "Competitor positioning and gaps",
    availability: "implemented",
    requiredAgent: null,
    requiredDependencies: ["market_research"],
    producedArtifactTypes: ["CompetitorAnalysis"],
  },
  {
    id: "financial_model",
    displayName: "Financial Model",
    description: "Scenarios, costs, and profitability",
    availability: "implemented",
    requiredAgent: "financial_analyst",
    requiredDependencies: ["business_plan", "market_research"],
    producedArtifactTypes: ["FinancialModel"],
  },
  { id: "brand_identity", displayName: "Brand Identity", description: "Brand foundations", availability: "coming_soon", requiredAgent: null, requiredDependencies: [], producedArtifactTypes: ["BrandStrategy"] },
  { id: "logo", displayName: "Logo", description: "Logo concepts", availability: "coming_soon", requiredAgent: null, requiredDependencies: ["brand_identity"], producedArtifactTypes: ["LogoConcept"] },
  { id: "visual_identity", displayName: "Visual Identity", description: "Typography and color systems", availability: "coming_soon", requiredAgent: null, requiredDependencies: ["brand_identity"], producedArtifactTypes: ["VisualIdentity"] },
  { id: "website", displayName: "Website", description: "Website structure and copy plan", availability: "coming_soon", requiredAgent: null, requiredDependencies: ["business_plan"], producedArtifactTypes: ["WebsiteStructure"] },
  { id: "packaging", displayName: "Packaging", description: "Packaging system", availability: "coming_soon", requiredAgent: null, requiredDependencies: ["brand_identity"], producedArtifactTypes: [] },
  { id: "social_media", displayName: "Social Media", description: "Social media campaigns", availability: "coming_soon", requiredAgent: null, requiredDependencies: ["marketing_strategy"], producedArtifactTypes: [] },
  { id: "marketing_strategy", displayName: "Marketing Strategy", description: "Channel and campaign roadmap", availability: "coming_soon", requiredAgent: null, requiredDependencies: ["business_plan"], producedArtifactTypes: ["MarketingPlan"] },
  { id: "operations", displayName: "Operations", description: "Operational blueprint", availability: "coming_soon", requiredAgent: null, requiredDependencies: ["business_plan"], producedArtifactTypes: ["OperationsPlan"] },
  { id: "investor_pitch", displayName: "Investor Pitch", description: "Pitch narrative", availability: "coming_soon", requiredAgent: null, requiredDependencies: ["business_plan", "financial_model"], producedArtifactTypes: ["PitchDeck"] },
  { id: "documents", displayName: "Documents", description: "Generated deliverable archive", availability: "implemented", requiredAgent: null, requiredDependencies: [], producedArtifactTypes: [] },
  { id: "physical_space_design", displayName: "Physical Space Design", description: "In-store layout and spatial system", availability: "coming_soon", requiredAgent: null, requiredDependencies: ["brand_identity"], producedArtifactTypes: [] },
];

const goalToCapability: Array<{ pattern: RegExp; capabilityId: string }> = [
  { pattern: /brand identity/i, capabilityId: "brand_identity" },
  { pattern: /website/i, capabilityId: "website" },
  { pattern: /packaging/i, capabilityId: "packaging" },
  { pattern: /social media/i, capabilityId: "social_media" },
  { pattern: /launch campaign/i, capabilityId: "marketing_strategy" },
  { pattern: /business strategy/i, capabilityId: "business_plan" },
  { pattern: /physical space/i, capabilityId: "physical_space_design" },
  { pattern: /workflow/i, capabilityId: "operations" },
];

function inferSelectedCapabilities(goals: string[]): Set<string> {
  const selected = new Set<string>(["business_plan", "market_research", "financial_model"]);
  for (const goal of goals) {
    const match = goalToCapability.find((entry) => entry.pattern.test(goal));
    if (match) selected.add(match.capabilityId);
  }
  return selected;
}

export function resolveCapabilities(input: {
  artifacts: ArtifactRecord[];
  selectedGoals: string[];
}): CapabilityView[] {
  const selectedSet = inferSelectedCapabilities(input.selectedGoals);
  const marketResearchArtifacts = input.artifacts.filter((artifact) => artifact.outputType === "MarketResearchReport");

  const competitorDerivedArtifacts = marketResearchArtifacts.filter((artifact) => {
    const content = artifact.content as {
      competitorDataStatus?: string;
      unavailableCompetitorOutcome?: unknown;
      competitors?: unknown[];
    };
    if (Array.isArray(content.competitors) && content.competitors.length > 0) return true;
    if (content.competitorDataStatus === "unavailable" && content.unavailableCompetitorOutcome) return true;
    return false;
  });

  return capabilities.map((capability) => {
    const matchingArtifacts = capability.id === "competitor_analysis"
      ? [
          ...input.artifacts.filter((artifact) => capability.producedArtifactTypes.includes(artifact.outputType)),
          ...competitorDerivedArtifacts,
        ]
      : input.artifacts.filter((artifact) => capability.producedArtifactTypes.includes(artifact.outputType));
    const generatedArtifactIds = matchingArtifacts.map((artifact) => artifact.artifactId);
    const selectedByUser = selectedSet.has(capability.id);

    let status: CapabilityStatus = "not_selected";
    if (generatedArtifactIds.length > 0) {
      status = "generated";
    } else if (capability.availability === "coming_soon") {
      status = selectedByUser ? "selected_but_not_available" : "coming_soon";
    } else if (selectedByUser) {
      const hasBlockingDependency = capability.requiredDependencies.some((dependency) => {
        const dependencyCapability = capabilities.find((candidate) => candidate.id === dependency);
        if (!dependencyCapability) return false;
        const dependencyGenerated = input.artifacts.some((artifact) => dependencyCapability.producedArtifactTypes.includes(artifact.outputType));
        return dependencyCapability.producedArtifactTypes.length > 0 && !dependencyGenerated;
      });
      status = hasBlockingDependency ? "blocked" : "available";
    } else if (capability.id === "documents") {
      status = "available";
    }

    return {
      ...capability,
      status,
      selectedByUser,
      generatedArtifactIds,
    };
  });
}
