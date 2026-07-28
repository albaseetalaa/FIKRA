import { AgentID } from "../types/agents";
import { getAgentProvider, getAgentModel } from "../config";
import { getOutputBudget } from "./outputBudgets";

export interface ModelConfig {
  provider: string; // provider id, e.g., 'mock' or 'openai'
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

const defaultModels: Record<AgentID, ModelConfig> = {
  business_strategist: {
    provider: getAgentProvider("business_strategist"),
    model: getAgentModel("business_strategist"),
    temperature: 0.2,
    maxTokens: getOutputBudget("BusinessPlan").base,
    timeoutMs: 60000,
  },
  market_research: {
    provider: getAgentProvider("market_research"),
    model: getAgentModel("market_research"),
    temperature: 0.2,
    maxTokens: getOutputBudget("MarketResearchReport").base,
    timeoutMs: 15000,
  },
  financial_analyst: {
    provider: getAgentProvider("financial_analyst"),
    model: getAgentModel("financial_analyst"),
    temperature: 0.2,
    maxTokens: getOutputBudget("FinancialModel").base,
    timeoutMs: 60000,
  },
  brand_strategist: {
    provider: getAgentProvider("brand_strategist"),
    model: getAgentModel("brand_strategist"),
    temperature: 0.3,
    maxTokens: 600,
    timeoutMs: 15000,
  },
  naming_expert: {
    provider: getAgentProvider("naming_expert"),
    model: getAgentModel("naming_expert"),
    temperature: 0.8,
    maxTokens: 400,
    timeoutMs: 15000,
  },
  logo_director: {
    provider: getAgentProvider("logo_director"),
    model: getAgentModel("logo_director"),
    temperature: 0.7,
    maxTokens: 800,
    timeoutMs: 15000,
  },
  visual_identity: {
    provider: getAgentProvider("visual_identity"),
    model: getAgentModel("visual_identity"),
    temperature: 0.6,
    maxTokens: 700,
    timeoutMs: 15000,
  },
  website_architect: {
    provider: getAgentProvider("website_architect"),
    model: getAgentModel("website_architect"),
    temperature: 0.25,
    maxTokens: 1200,
    timeoutMs: 15000,
  },
  marketing_strategist: {
    provider: getAgentProvider("marketing_strategist"),
    model: getAgentModel("marketing_strategist"),
    temperature: 0.35,
    maxTokens: 800,
    timeoutMs: 15000,
  },
  operations_consultant: {
    provider: getAgentProvider("operations_consultant"),
    model: getAgentModel("operations_consultant"),
    temperature: 0.2,
    maxTokens: 600,
    timeoutMs: 15000,
  },
  pitch_deck_expert: {
    provider: getAgentProvider("pitch_deck_expert"),
    model: getAgentModel("pitch_deck_expert"),
    temperature: 0.4,
    maxTokens: 1200,
    timeoutMs: 15000,
  },
  growth_advisor: {
    provider: getAgentProvider("growth_advisor"),
    model: getAgentModel("growth_advisor"),
    temperature: 0.6,
    maxTokens: 600,
    timeoutMs: 15000,
  },
};

export default defaultModels;
