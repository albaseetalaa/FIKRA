import { AgentID } from "../types/agents";

export interface PipelineStep {
  id: string;
  agent: AgentID;
  description?: string;
  dependsOn?: string[];
}

export interface Pipeline {
  id: string;
  name: string;
  steps: PipelineStep[];
  requiredAgents: AgentID[];
  expectedOutputs: string[];
}

export const pipelines: Pipeline[] = [
  {
    id: "project_creation",
    name: "Project Creation Pipeline",
    steps: [
      { id: "p1-step1", agent: "business_strategist", description: "Define strategy" },
      { id: "p1-step2", agent: "market_research", description: "Collect market data", dependsOn: ["p1-step1"] },
      { id: "p1-step3", agent: "naming_expert", description: "Generate names", dependsOn: ["p1-step1"] },
    ],
    requiredAgents: ["business_strategist", "market_research", "naming_expert"],
    expectedOutputs: ["BusinessPlan", "MarketResearchReport", "NameCandidates"],
  },
  {
    id: "business_planning",
    name: "Business Planning Pipeline",
    steps: [
      { id: "bp-1", agent: "financial_analyst", description: "Financial projections" },
      { id: "bp-2", agent: "brand_strategist", description: "Brand direction" },
    ],
    requiredAgents: ["financial_analyst", "brand_strategist"],
    expectedOutputs: ["FinancialReport", "BrandStrategy"],
  },
  {
    id: "brand_pipeline",
    name: "Brand Pipeline",
    steps: [
      { id: "br-1", agent: "logo_director", description: "Logo concepts" },
      { id: "br-2", agent: "visual_identity", description: "Visual identity" },
    ],
    requiredAgents: ["logo_director", "visual_identity"],
    expectedOutputs: ["LogoConcept", "BrandStrategy"],
  },
  {
    id: "website_pipeline",
    name: "Website Pipeline",
    steps: [
      { id: "ws-1", agent: "website_architect", description: "Sitemap and pages" },
    ],
    requiredAgents: ["website_architect"],
    expectedOutputs: ["WebsiteStructure"],
  },
  {
    id: "marketing_pipeline",
    name: "Marketing Pipeline",
    steps: [
      { id: "mk-1", agent: "marketing_strategist", description: "Channel strategy" },
    ],
    requiredAgents: ["marketing_strategist"],
    expectedOutputs: ["MarketingPlan"],
  },
  {
    id: "investor_pipeline",
    name: "Investor Pipeline",
    steps: [
      { id: "iv-1", agent: "pitch_deck_expert", description: "Pitch deck" },
    ],
    requiredAgents: ["pitch_deck_expert"],
    expectedOutputs: ["PitchDeck"],
  },
  {
    id: "business_strategist_only",
    name: "Business Strategist Only",
    steps: [
      { id: "bs-1", agent: "business_strategist", description: "Generate a BusinessPlan" },
    ],
    requiredAgents: ["business_strategist"],
    expectedOutputs: ["BusinessPlan"],
  },
  {
    id: "business_strategist_market_research",
    name: "Business Strategist + Market Research",
    steps: [
      { id: "bs-1", agent: "business_strategist", description: "Generate a BusinessPlan" },
      { id: "mr-1", agent: "market_research", description: "Generate a MarketResearchReport", dependsOn: ["bs-1"] },
      { id: "fa-1", agent: "financial_analyst", description: "Generate a FinancialModel", dependsOn: ["bs-1", "mr-1"] },
    ],
    requiredAgents: ["business_strategist", "market_research", "financial_analyst"],
    expectedOutputs: ["BusinessPlan", "MarketResearchReport", "FinancialModel"],
  },
];

export default pipelines;
