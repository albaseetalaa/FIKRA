export type AgentID =
  | "business_strategist"
  | "market_research"
  | "financial_analyst"
  | "brand_strategist"
  | "naming_expert"
  | "logo_director"
  | "visual_identity"
  | "website_architect"
  | "marketing_strategist"
  | "operations_consultant"
  | "pitch_deck_expert"
  | "growth_advisor";

export enum AgentStatus {
  Idle = "idle",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
}

export interface JsonSchema {
  title?: string;
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

import { OutputModelName } from "./outputs";

export interface AgentDefinition<_I = unknown, _O = unknown> {
  id: AgentID;
  name: string;
  description: string;
  responsibilities: string[];
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  outputModel?: OutputModelName;
  status?: AgentStatus;
  priority?: number;
}

export interface AgentRunResult<O = unknown> {
  agentId: AgentID;
  success: boolean;
  output?: O;
  error?: string;
  metadata?: Record<string, unknown>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}
