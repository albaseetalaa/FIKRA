import type { AgentID } from "../types/agents";
import type { OutputModelName } from "../types/outputs";
import type { ProjectContext } from "../context";
import type AIProvider from "../providers/interface";
import type { ModelConfig } from "../providers/models";
import type { ValidationResult } from "../validation/validator";
import type { ArtifactStore } from "../store/artifactStore";
import type { ProviderManager } from "../providers/manager";
import type { BusinessVertical } from "../context";

export type AgentCategory = "strategy" | "research" | "finance" | "brand" | "operations" | "growth";

export type AgentCapability =
  | "database_read"
  | "database_write"
  | "web_research"
  | "file_read"
  | "file_write"
  | "image_generation"
  | "browser_automation"
  | "design_generation"
  | "external_api";

export type LifecycleHookName = "prepare" | "beforeExecute" | "afterExecute" | "beforePersist" | "afterPersist";

export interface TokenBudgetPolicy {
  initialOutputTokens: number;
  repairOutputTokens: number;
  maxOutputTokens: number;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  estimatedCostUsd?: number;
}

export interface RetryPolicyConfig {
  maxProviderCalls: number;
  maxRepairAttempts: number;
  transportRetriesPerCall: number;
}

export interface TimeoutPolicyConfig {
  timeoutMs: number;
}

export interface PersistencePolicyConfig {
  persistInvalidAttempts: boolean;
  persistValidArtifactsOnly: boolean;
}

export interface AgentLifecycleHooks {
  prepareInput?: (ctx: AgentExecutionContext, rawInput: Record<string, unknown>) => Record<string, unknown>;
  beforeExecute?: (ctx: AgentExecutionContext) => Promise<void> | void;
  afterExecute?: (ctx: AgentExecutionContext, providerOutput: unknown) => Promise<void> | void;
  beforePersist?: (ctx: AgentExecutionContext, artifact: unknown) => Promise<void> | void;
  afterPersist?: (ctx: AgentExecutionContext, artifactId: string) => Promise<void> | void;
}

export interface AgentEvaluationFixtures {
  validFixtureName?: string;
  invalidFixtureName?: string;
  deterministicSuiteNames?: string[];
}

export interface AgentRepairPolicy {
  enabled: boolean;
  buildRepairPrompt: (input: {
    originalPrompt: string;
    issues: string[];
    outputType: OutputModelName;
    projectContext: ProjectContext;
  }) => string;
}

export interface AgentDefinition {
  id: AgentID;
  version: string;
  displayName: string;
  description: string;
  category: AgentCategory;
  supportedVerticals: BusinessVertical[] | ["any"];
  requiredCapabilities: AgentCapability[];
  requiredProjectContextFields: Array<keyof ProjectContext>;
  planningTags?: string[];
  selectableByDefault?: boolean;
  inputArtifactTypes: OutputModelName[];
  outputArtifactType: OutputModelName;
  promptBuilder: (ctx: AgentExecutionContext) => string;
  providerSchema: (ctx: AgentExecutionContext) => Record<string, unknown> | null;
  structuralValidator: (raw: unknown, ctx: AgentExecutionContext) => ValidationResult<unknown>;
  semanticValidator: (raw: unknown, ctx: AgentExecutionContext) => string[];
  tokenBudget: TokenBudgetPolicy;
  retryPolicy: RetryPolicyConfig;
  repairPolicy: AgentRepairPolicy;
  timeoutPolicy: TimeoutPolicyConfig;
  persistencePolicy: PersistencePolicyConfig;
  dependencies: AgentID[];
  optionalDependencies: AgentID[];
  lifecycleHooks?: AgentLifecycleHooks;
  evaluationFixtures?: AgentEvaluationFixtures;
  enabled: boolean;
}

export interface AgentExecutionContext {
  projectId: string;
  workflowRunId?: string;
  taskId?: string;
  projectContext: ProjectContext;
  currentDate: string;
  clock: {
    nowISO: () => string;
    nowMs: () => number;
  };
  upstreamArtifacts: Record<string, unknown>;
  selectedProviderId: string;
  providerModel: string;
  outputTokenBudget: TokenBudgetPolicy;
  attemptNumber: number;
  repairAttemptNumber: number;
  executionMode: "normal" | "repair" | "resume";
  trace: {
    pipelineId?: string;
    agentId?: string;
    requestId?: string;
    correlationId?: string;
  };
  cancellationSignal?: AbortSignal;
  requestedCapabilities?: AgentCapability[];
  requestedArtifactTypes?: OutputModelName[];
  requestedGoals?: string[];
  persistence: {
    artifactStore: ArtifactStore;
  };
  providerManager: ProviderManager;
  modelConfig?: ModelConfig;
  declaredCapabilities: AgentCapability[];
}

export type AgentLifecycleFailureType =
  | "retryable_failure"
  | "repairable_validation_failure"
  | "non_retryable_failure"
  | "requires_user_input"
  | "paused"
  | "cancelled";

export type AgentLifecycleResult =
  | {
      kind: "success";
      output: unknown;
      artifactId: string;
      metadata?: Record<string, unknown>;
      usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    }
  | {
      kind: AgentLifecycleFailureType;
      message: string;
      retryable: boolean;
      issues?: string[];
      metadata?: Record<string, unknown>;
    };

export interface ExecutableAgent {
  definition: AgentDefinition;
  execute: (ctx: AgentExecutionContext, rawInput: Record<string, unknown>) => Promise<AgentLifecycleResult>;
}

export interface AgentFactoryServices {
  providerManager: ProviderManager;
  artifactStore: ArtifactStore;
}

export interface AgentFactoryBuildOptions {
  providerId: string;
  model: string;
  pipelineId?: string;
  getProvider?: () => AIProvider | undefined;
}

export interface OutputContract {
  outputType: OutputModelName;
  version: string;
  tsTypeName: string;
  providerSchema: (ctx: ProjectContext) => Record<string, unknown> | null;
  structuralValidator: (raw: unknown, projectContext?: ProjectContext) => ValidationResult<unknown>;
  semanticValidator: (raw: unknown, projectContext?: ProjectContext) => string[];
  promptRequirements: string[];
  requiresStructuredOutput?: boolean;
  allowsPassThroughStructuralValidation?: boolean;
  requiresSemanticValidation?: boolean;
  persistenceMetadata: {
    validationStatusOnSuccess: "valid";
    persistInvalidArtifacts: boolean;
    schemaVersion: number;
    artifactVersion: number;
  };
  migrationMetadata: {
    currentVersion: string;
    previousVersions: string[];
  };
}
