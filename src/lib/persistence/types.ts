export type PersistenceProvider = "memory" | "supabase";

export type ExecutionStatus = "queued" | "running" | "completed" | "failed";

export interface ProjectRecord {
  id: string;
  name: string;
  idea: string;
  metadata?: Record<string, unknown> | null;
  status: ExecutionStatus;
  activePipelineId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  sanitizedErrorMessage: string | null;
}

export interface WorkflowRunRecord {
  id: string;
  projectId: string;
  pipelineId: string;
  status: ExecutionStatus;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTaskRecord {
  id: string;
  workflowRunId: string;
  projectId: string;
  agentId: string;
  outputType: string | null;
  providerId: string | null;
  model: string | null;
  status: ExecutionStatus;
  dependencyIds: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AttemptStatus = "running" | "completed" | "failed";

export interface AttemptRecord {
  id: string;
  taskId: string;
  attemptNumber: number;
  providerId: string | null;
  model: string | null;
  status: AttemptStatus;
  errorCode: string | null;
  retryable: boolean;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ProjectHistoryItem {
  id: string;
  name: string;
  ideaExcerpt: string;
  status: ExecutionStatus;
  createdAt: string;
  updatedAt: string;
  workflowStatus?: string | null;
  pausedTaskId?: string | null;
  userInputRequest?: unknown | null;
}

export interface ProjectStatusView {
  projectId: string;
  name: string;
  idea: string;
  status: ExecutionStatus;
  currentStep: ExecutionStatus;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  businessPlan: unknown | null;
  marketResearchReport: unknown | null;
  financialModel: unknown | null;
  projectScore?: unknown | null;
  workflowStatus?: string | null;
  pausedTaskId?: string | null;
  userInputRequest?: unknown | null;
  capabilities?: unknown[];
}

export interface WorkflowCheckpointRecord {
  workflowRunId: string;
  projectId: string;
  currentTaskId: string;
  workflowStatus: string;
  taskStatus: string;
  completedTaskIds: string[];
  pendingTaskIds: string[];
  dependencyState: Record<string, string[]>;
  attemptCounters: Record<string, number>;
  executionContext: Record<string, unknown>;
  userInputRequest: Record<string, unknown>;
  requestId: string;
  checkpointVersion: number;
  requestConsumedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
