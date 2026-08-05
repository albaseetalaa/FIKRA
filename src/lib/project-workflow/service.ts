import "../../ai/providers/setup";
import { agents } from "../../ai/agents/definitions";
import { AttemptRecord as OrchestratorAttemptRecord, TaskRecord } from "../../ai/orchestrator";
import { CEOOrchestrator } from "../../ai/ceo";
import { pipelines } from "../../ai/pipelines/pipelines";
import defaultModels from "../../ai/providers/models";
import { normalizeProjectContext, type ProjectContextInput } from "../../ai/context";
import type { Clock } from "../time/clock";
import { systemClock } from "../time/clock";
import type { ResumeResult, ResumeWorkflowInput, WorkflowCheckpoint } from "../../ai/reliability";
import {
  InvalidCheckpointError,
  ResumeRequestAlreadyConsumedError,
  ResumeRequestMismatchError,
  ResumeValidationError,
  StaleCheckpointError,
  WorkflowNotPausedError,
  validateUserInputValues,
} from "../../ai/reliability";
import {
  WorkflowStateMachine,
  mapTaskStatusToPersistence,
  mapWorkflowStatusToPersistence,
} from "../../ai/workflow/stateMachine";
import { getPersistenceContainer, getRequestPersistenceContainer, getSystemPersistenceContainer } from "../persistence/setup";
import type { AuthorizationContext } from "../persistence/setup";
import type { AttemptStatus, ProjectHistoryItem, ProjectStatusView, WorkflowCheckpointRecord, WorkflowRunRecord } from "../persistence/types";
import type { ProjectContext } from "../../ai/context";
import type { CreateProjectRpcExecutor } from "./createProjectRpc";
import { buildProjectStatusView, excerptIdea, makeAttemptId, makeTaskId, makeWorkflowRunId, sanitizeErrorMessage } from "./store";
import { resolveCapabilities } from "./capabilityRegistry";
import { calculateProjectScore } from "./projectScore";

const runningProjects = new Set<string>();
const PIPELINE_ID = "ceo_orchestrated";
let workflowClock: Clock = systemClock;

export function setWorkflowClockForTests(clock: Clock) {
  workflowClock = clock;
}

export function resetWorkflowClockForTests() {
  workflowClock = systemClock;
}

const outputTypeByAgent: Record<string, string | null> = {
  business_strategist: "BusinessPlan",
  market_research: "MarketResearchReport",
  financial_analyst: "FinancialModel",
};

export interface CreateProjectInput {
  idea: string;
  businessName?: string;
  industry?: string;
  country?: string;
  city?: string;
  stage?: string;
  audience?: string;
  ageRange?: string;
  customerType?: string;
  goals?: string[];
  budget?: string;
  timeline?: string;
  currency?: string;
}

function inferAttemptStatus(attempt: OrchestratorAttemptRecord): AttemptStatus {
  if (attempt.error) return "failed";
  if (attempt.validation?.success === false) return "failed";
  if (attempt.validation?.success === true) return "completed";
  return "running";
}

function inferAttemptErrorCode(attempt: OrchestratorAttemptRecord): string | null {
  if (attempt.error?.code) return attempt.error.code;
  const stage = attempt.validationDiagnostic?.validationStage;
  if (stage === "semantic_validation") return "SEMANTIC_VALIDATION_FAILED";
  if (stage === "json_parse") return "JSON_PARSE_FAILED";
  if (attempt.validation?.success === false) return "SCHEMA_VALIDATION_FAILED";
  return null;
}

function extractAttemptMeta(attempt: OrchestratorAttemptRecord) {
  const raw = (attempt.rawOutput ?? {}) as {
    providerId?: string;
    model?: string;
    latencyMs?: number;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    metadata?: { startedAt?: string; completedAt?: string };
  };

  return {
    providerId: typeof raw.providerId === "string" ? raw.providerId : null,
    model: typeof raw.model === "string" ? raw.model : null,
    latencyMs: typeof raw.latencyMs === "number" ? raw.latencyMs : null,
    inputTokens: typeof raw.usage?.inputTokens === "number" ? raw.usage.inputTokens : null,
    outputTokens: typeof raw.usage?.outputTokens === "number" ? raw.usage.outputTokens : null,
    totalTokens: typeof raw.usage?.totalTokens === "number" ? raw.usage.totalTokens : null,
    startedAt: typeof raw.metadata?.startedAt === "string" ? raw.metadata.startedAt : attempt.timestamp,
    completedAt: typeof raw.metadata?.completedAt === "string" ? raw.metadata.completedAt : null,
  };
}

async function loadLatestArtifactByType(projectId: string, workflowRunId: string, outputType: string) {
  const { artifacts } = getPersistenceContainer();
  const all = await artifacts.list(projectId);
  return all.find((item) => item.workflowRunId === workflowRunId && item.outputType === outputType && item.validationStatus === "valid") ?? null;
}

async function loadLatestBusinessPlan(projectId: string, workflowRunId: string) {
  return loadLatestArtifactByType(projectId, workflowRunId, "BusinessPlan");
}

async function loadLatestMarketResearchReport(projectId: string, workflowRunId: string) {
  return loadLatestArtifactByType(projectId, workflowRunId, "MarketResearchReport");
}

async function loadLatestFinancialModel(projectId: string, workflowRunId: string) {
  return loadLatestArtifactByType(projectId, workflowRunId, "FinancialModel");
}

async function loadLatestProjectScore(projectId: string, workflowRunId: string) {
  return loadLatestArtifactByType(projectId, workflowRunId, "ProjectScore");
}

async function updateRunProgress(workflowRunId: string, projectId: string) {
  const persistence = getPersistenceContainer();
  const tasks = await persistence.workflowTasks.listByRun(workflowRunId);
  if (tasks.length === 0) return;

  const completed = tasks.filter((task) => task.status === "completed").length;
  const progress = Math.round((completed / tasks.length) * 100);
  await persistence.workflowRuns.update(workflowRunId, { progress, updatedAt: workflowClock.nowISO() });

  const project = await persistence.projects.getById(projectId);
  if (project && project.status === "queued") {
    await persistence.projects.update(projectId, { status: "running", sanitizedErrorMessage: null, errorCode: null });
  }
}

function toWorkflowCheckpoint(record: WorkflowCheckpointRecord): WorkflowCheckpoint {
  return {
    workflowRunId: record.workflowRunId,
    projectId: record.projectId,
    currentTaskId: record.currentTaskId,
    workflowStatus: record.workflowStatus as WorkflowCheckpoint["workflowStatus"],
    taskStatus: record.taskStatus as WorkflowCheckpoint["taskStatus"],
    completedTaskIds: record.completedTaskIds,
    pendingTaskIds: record.pendingTaskIds,
    dependencyState: record.dependencyState,
    attemptCounters: record.attemptCounters,
    userInputRequest: record.userInputRequest as unknown as WorkflowCheckpoint["userInputRequest"],
    executionContext: record.executionContext,
    checkpointVersion: record.checkpointVersion,
    requestConsumedAt: record.requestConsumedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function persistCheckpoint(checkpoint: WorkflowCheckpoint) {
  const persistence = getPersistenceContainer();
  await persistence.checkpoints.upsert({
    workflowRunId: checkpoint.workflowRunId,
    projectId: checkpoint.projectId,
    currentTaskId: checkpoint.currentTaskId,
    workflowStatus: checkpoint.workflowStatus,
    taskStatus: checkpoint.taskStatus,
    completedTaskIds: checkpoint.completedTaskIds,
    pendingTaskIds: checkpoint.pendingTaskIds,
    dependencyState: checkpoint.dependencyState,
    attemptCounters: checkpoint.attemptCounters,
    executionContext: checkpoint.executionContext,
    userInputRequest: checkpoint.userInputRequest as unknown as Record<string, unknown>,
    requestId: checkpoint.userInputRequest.requestId,
    checkpointVersion: checkpoint.checkpointVersion,
    requestConsumedAt: checkpoint.requestConsumedAt,
  });
}

export async function createProject(
  input: CreateProjectInput,
  executor: CreateProjectRpcExecutor,
): Promise<{ projectId: string; status: "queued"; workflowRunId: string }> {
  const result = await executor.execute({
    p_idea: input.idea,
    p_business_name: input.businessName ?? null,
    p_industry: input.industry ?? null,
    p_country: input.country ?? null,
    p_city: input.city ?? null,
    p_stage: input.stage ?? null,
    p_audience: input.audience ?? null,
    p_age_range: input.ageRange ?? null,
    p_customer_type: input.customerType ?? null,
    p_goals: input.goals ?? null,
    p_budget: input.budget ?? null,
    p_timeline: input.timeline ?? null,
    p_currency: input.currency ?? null,
  });

  return {
    projectId: result.projectId,
    status: "queued",
    workflowRunId: result.workflowRunId,
  };
}

export async function listProjectHistory(ctx: AuthorizationContext, limit = 30): Promise<ProjectHistoryItem[]> {
  const request = getRequestPersistenceContainer(ctx);
  const projects = await request.projects.list(limit);
  const system = getSystemPersistenceContainer();
  const items: ProjectHistoryItem[] = [];

  for (const project of projects) {
    const run = await system.workflowRuns.getLatestByProject(project.id);
    const checkpoint = run ? await system.checkpoints.getActiveByWorkflowRunId(run.id) : null;
    items.push({
      id: project.id,
      name: project.name,
      ideaExcerpt: excerptIdea(project.idea),
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      workflowStatus: checkpoint?.workflowStatus ?? null,
      pausedTaskId: checkpoint?.currentTaskId ?? null,
      userInputRequest: checkpoint?.userInputRequest ?? null,
    });
  }

  return items;
}

async function ensureQueuedRun(projectId: string): Promise<WorkflowRunRecord | null> {
  const persistence = getPersistenceContainer();
  const latestRun = await persistence.workflowRuns.getLatestByProject(projectId);
  if (!latestRun) return null;
  if (latestRun.status === "queued" || latestRun.status === "running") return latestRun;

  return persistence.workflowRuns.create({
    id: makeWorkflowRunId(),
    projectId,
    pipelineId: PIPELINE_ID,
    status: "queued",
    progress: 0,
  });
}

export interface VerifiedProjectHandoff {
  projectId: string;
  organizationId: string;
}

export class ProjectStartAuthorizationError extends Error {
  constructor() {
    super("Project start authorization failed.");
    this.name = "ProjectStartAuthorizationError";
  }
}

export async function authorizeProjectStart(ctx: AuthorizationContext, projectId: string): Promise<VerifiedProjectHandoff | null> {
  const request = getRequestPersistenceContainer(ctx);
  const project = await request.projects.getById(projectId);
  if (!project || project.organizationId === null) {
    return null;
  }

  return {
    projectId: project.id,
    organizationId: project.organizationId,
  };
}

export interface VerifiedWorkflowResumeHandoff {
  workflowRunId: string;
  projectId: string;
  organizationId: string;
}

export async function authorizeWorkflowResume(
  ctx: AuthorizationContext,
  workflowRunId: string,
): Promise<VerifiedWorkflowResumeHandoff | null> {
  const request = getRequestPersistenceContainer(ctx);
  const target = await request.workflowResume.findProjectForWorkflowRun(workflowRunId);

  if (!target) {
    return null;
  }

  return {
    workflowRunId: target.workflowRunId,
    projectId: target.projectId,
    organizationId: target.organizationId,
  };
}

export async function startBusinessStrategistExecution(handoff: VerifiedProjectHandoff): Promise<void> {
  const system = getSystemPersistenceContainer();
  const project = await system.projects.getById(handoff.projectId);
  if (!project || project.organizationId === null || project.organizationId !== handoff.organizationId) {
    throw new ProjectStartAuthorizationError();
  }

  if (runningProjects.has(project.id)) return;

  const workflowRun = await ensureQueuedRun(project.id);
  if (!workflowRun) {
    throw new Error("No workflow run available.");
  }

  runningProjects.add(project.id);
  void runExecution(project.id, workflowRun.id, project.idea).finally(() => {
    runningProjects.delete(project.id);
  });
}

export class WorkflowResumeAuthorizationError extends Error {
  constructor() {
    super("Workflow resume authorization failed.");
    this.name = "WorkflowResumeAuthorizationError";
  }
}

export async function resumeWorkflow(
  handoff: VerifiedWorkflowResumeHandoff,
  input: Omit<ResumeWorkflowInput, "workflowRunId">,
): Promise<ResumeResult> {
  const system = getSystemPersistenceContainer();

  const project = await system.projects.getById(handoff.projectId);
  if (
    !project ||
    project.id !== handoff.projectId ||
    project.organizationId === null ||
    project.organizationId !== handoff.organizationId
  ) {
    throw new WorkflowResumeAuthorizationError();
  }

  const run = await system.workflowRuns.getById(handoff.workflowRunId);
  if (!run || run.id !== handoff.workflowRunId || run.projectId !== handoff.projectId) {
    throw new WorkflowResumeAuthorizationError();
  }

  if (project.status === "completed" || project.status === "failed") {
    throw new WorkflowNotPausedError("Completed or failed workflows cannot be resumed.");
  }

  const checkpointRecord = await system.checkpoints.getActiveByWorkflowRunId(handoff.workflowRunId);
  if (!checkpointRecord) {
    throw new WorkflowNotPausedError();
  }

  const checkpoint = toWorkflowCheckpoint(checkpointRecord);
  if (checkpoint.workflowStatus !== "waiting_for_user") {
    throw new WorkflowNotPausedError();
  }

  if (checkpoint.userInputRequest.requestId !== input.requestId) {
    throw new ResumeRequestMismatchError();
  }

  if (checkpoint.requestConsumedAt) {
    throw new ResumeRequestAlreadyConsumedError();
  }

  if (checkpoint.checkpointVersion !== input.checkpointVersion) {
    throw new StaleCheckpointError();
  }

  const validation = validateUserInputValues(checkpoint.userInputRequest.requiredFields, input.values);
  if (!validation.ok) {
    throw new ResumeValidationError(validation.message);
  }

  const consumed = await system.checkpoints.consumeRequest({
    workflowRunId: handoff.workflowRunId,
    requestId: input.requestId,
    checkpointVersion: input.checkpointVersion,
  });

  if (!consumed) {
    throw new ResumeRequestAlreadyConsumedError();
  }

  const consumedCheckpoint = toWorkflowCheckpoint(consumed);
  const mergedValues = {
    ...(consumedCheckpoint.executionContext?.userInputValues as Record<string, unknown> | undefined),
    ...validation.normalized,
  };

  if (runningProjects.has(project.id)) {
    throw new WorkflowNotPausedError("Workflow is already running.");
  }

  runningProjects.add(project.id);
  try {
    await runExecution(project.id, handoff.workflowRunId, project.idea, {
      resumeCheckpoint: {
        ...consumedCheckpoint,
        executionContext: {
          ...consumedCheckpoint.executionContext,
          userInputValues: mergedValues,
        },
      },
      userInputValues: mergedValues,
    });
  } finally {
    runningProjects.delete(project.id);
  }

  const latestCheckpoint = await system.checkpoints.getActiveByWorkflowRunId(handoff.workflowRunId);
  const updatedRun = await system.workflowRuns.getById(handoff.workflowRunId);
  if (!updatedRun) {
    throw new InvalidCheckpointError("Workflow run missing after resume.");
  }

  if (latestCheckpoint?.workflowStatus === "waiting_for_user") {
    const resumedCheckpoint = toWorkflowCheckpoint(latestCheckpoint);
    return {
      state: "paused_again",
      workflowRunId: handoff.workflowRunId,
      checkpointVersion: resumedCheckpoint.checkpointVersion,
      message: "Workflow paused again and requires additional input.",
      nextRequest: resumedCheckpoint.userInputRequest,
    };
  }

  if (updatedRun.status === "completed") {
    return {
      state: "resumed_completed",
      workflowRunId: handoff.workflowRunId,
      checkpointVersion: latestCheckpoint?.checkpointVersion ?? input.checkpointVersion + 1,
      message: "Workflow resumed and completed.",
    };
  }

  return {
    state: "resumed_running",
    workflowRunId: handoff.workflowRunId,
    checkpointVersion: latestCheckpoint?.checkpointVersion ?? input.checkpointVersion + 1,
    message: "Workflow resumed and is running.",
  };
}

export async function getProjectStatus(ctx: AuthorizationContext, projectId: string): Promise<ProjectStatusView | null> {
  const request = getRequestPersistenceContainer(ctx);
  const project = await request.projects.getById(projectId);
  if (!project) return null;

  const system = getSystemPersistenceContainer();
  const run = await system.workflowRuns.getLatestByProject(project.id);
  if (!run) {
    return {
      projectId: project.id,
      name: project.name,
      idea: project.idea,
      status: project.status,
      currentStep: project.status,
      errorMessage: project.sanitizedErrorMessage,
      startedAt: null,
      completedAt: project.completedAt,
      businessPlan: null,
      marketResearchReport: null,
      financialModel: null,
      workflowStatus: null,
      pausedTaskId: null,
      userInputRequest: null,
      capabilities: [],
    };
  }

  const businessPlanArtifact = await loadLatestBusinessPlan(project.id, run.id);
  const marketResearchArtifact = await loadLatestMarketResearchReport(project.id, run.id);
  const financialModelArtifact = await loadLatestFinancialModel(project.id, run.id);
  const projectScoreArtifact = await loadLatestProjectScore(project.id, run.id);
  const allArtifacts = await system.artifacts.list(project.id);
  const selectedGoals = Array.isArray(project.metadata?.goals) ? (project.metadata?.goals as string[]) : [];
  const capabilities = resolveCapabilities({
    artifacts: allArtifacts,
    selectedGoals,
  });
  const baseView = buildProjectStatusView(project, run, businessPlanArtifact, marketResearchArtifact, financialModelArtifact);
  const checkpoint = await system.checkpoints.getActiveByWorkflowRunId(run.id);
  if (!checkpoint) {
    return {
      ...baseView,
      workflowStatus: run.status,
      pausedTaskId: null,
      userInputRequest: null,
      projectScore: projectScoreArtifact?.content ?? null,
      capabilities,
    };
  }

  return {
    ...baseView,
    workflowStatus: checkpoint.workflowStatus,
    pausedTaskId: checkpoint.currentTaskId,
    userInputRequest: checkpoint.userInputRequest,
    projectScore: projectScoreArtifact?.content ?? null,
    capabilities,
  };
}

async function runExecution(
  projectId: string,
  workflowRunId: string,
  idea: string,
  options?: {
    resumeCheckpoint?: WorkflowCheckpoint;
    userInputValues?: Record<string, unknown>;
  },
) {
  const persistence = getPersistenceContainer();
  const persistedAttemptOffsetByTaskId = new Map<string, number>();
  const project = await persistence.projects.getById(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const metadata = (project.metadata ?? {}) as Record<string, unknown>;
  const normalizationInput: ProjectContextInput = {
    projectId,
    businessName: typeof metadata.businessName === "string" ? metadata.businessName : project.name,
    businessDescription: idea,
    industry: typeof metadata.industry === "string" ? metadata.industry : null,
    businessStage: typeof metadata.stage === "string" ? metadata.stage : null,
    country: typeof metadata.country === "string" ? metadata.country : null,
    city: typeof metadata.city === "string" ? metadata.city : null,
    currency: typeof metadata.currency === "string" ? metadata.currency : null,
    targetAudience: typeof metadata.audience === "string" ? metadata.audience : null,
    customerAgeRange: typeof metadata.ageRange === "string" ? metadata.ageRange : null,
    customerType: typeof metadata.customerType === "string" ? metadata.customerType : null,
    budgetRange: typeof metadata.budget === "string" ? metadata.budget : null,
    budgetCurrency: null,
    launchTimeline: typeof metadata.timeline === "string" ? metadata.timeline : null,
    selectedGoals: Array.isArray(metadata.goals) ? (metadata.goals as string[]) : [],
    projectCreatedAt: project.createdAt,
    currentDate: workflowClock.nowISO(),
  };
  const executionNow = workflowClock.nowISO();
  normalizationInput.currentDate = executionNow;
  const contextResult = normalizeProjectContext(normalizationInput, workflowClock);

  const persistedContextRaw = metadata.normalizedProjectContext;
  const persistedContext =
    persistedContextRaw && typeof persistedContextRaw === "object"
      ? (persistedContextRaw as ProjectContext)
      : null;
  const contextForExecution =
    persistedContext && persistedContext.projectId === projectId
      ? {
          ...persistedContext,
          currentDate: contextResult.context.currentDate,
        }
      : contextResult.context;

  if (!persistedContext || persistedContext.projectId !== projectId) {
    await persistence.projects.update(projectId, {
      metadata: {
        ...metadata,
        normalizedProjectContext: contextResult.context,
      },
    });
  }

  const workflowState = new WorkflowStateMachine("planning", workflowRunId);
  const startedAt = executionNow;
  const nowISO = () => workflowClock.nowISO();
  const transitionWorkflow = (next: "running" | "completed" | "failed") => {
    if (workflowState.status !== next) {
      workflowState.transitionTo(next);
    }
  };

  if (workflowState.status !== "running") {
    workflowState.transitionTo("running");
  }
  const persistenceRunningStatus = mapWorkflowStatusToPersistence(workflowState.status);

  await persistence.projects.update(projectId, {
    status: persistenceRunningStatus,
    sanitizedErrorMessage: null,
    errorCode: null,
  });

  await persistence.workflowRuns.update(workflowRunId, {
    status: persistenceRunningStatus,
    progress: 0,
    startedAt,
  });

  try {
    const ceo = new CEOOrchestrator(pipelines, agents, {
      models: defaultModels,
      hooks: {
        onTaskChanged: async (task: TaskRecord) => {
          const status = mapTaskStatusToPersistence(task.status);
          const outputType = task.result?.output ? (outputTypeByAgent[task.step.agent] ?? null) : null;
          await persistence.workflowTasks.upsert({
            id: makeTaskId(workflowRunId, task.id),
            workflowRunId,
            projectId,
            agentId: task.step.agent,
            outputType,
            providerId: (task.result?.metadata?.providerId as string | undefined) ?? null,
            model: (task.result?.metadata?.model as string | undefined) ?? null,
            status,
            dependencyIds: task.step.dependsOn ?? [],
            startedAt: status === "running" ? nowISO() : undefined,
            completedAt: status === "completed" || status === "failed" ? nowISO() : undefined,
          });
          await updateRunProgress(workflowRunId, projectId);
        },
        onAttemptRecorded: async (task: TaskRecord, attempt: OrchestratorAttemptRecord) => {
          const taskId = makeTaskId(workflowRunId, task.id);
          const meta = extractAttemptMeta(attempt);
          const attemptStatus = inferAttemptStatus(attempt);

          let persistedAttemptOffset = persistedAttemptOffsetByTaskId.get(taskId);
          if (persistedAttemptOffset === undefined) {
            const existingAttempts = await persistence.attempts.listByTask(taskId);
            persistedAttemptOffset = existingAttempts.reduce((max, item) => Math.max(max, item.attemptNumber), 0);
            persistedAttemptOffsetByTaskId.set(taskId, persistedAttemptOffset);
          }

          const persistedAttemptNumber = persistedAttemptOffset + attempt.attempt;
          await persistence.attempts.create({
            id: makeAttemptId(taskId, persistedAttemptNumber),
            taskId,
            attemptNumber: persistedAttemptNumber,
            providerId: meta.providerId,
            model: meta.model,
            status: attemptStatus,
            errorCode: inferAttemptErrorCode(attempt),
            retryable: attempt.error?.retryable ?? false,
            latencyMs: meta.latencyMs,
            inputTokens: meta.inputTokens,
            outputTokens: meta.outputTokens,
            totalTokens: meta.totalTokens,
            startedAt: meta.startedAt,
            completedAt: meta.completedAt,
          });

          persistedAttemptOffsetByTaskId.set(
            taskId,
            Math.max(persistedAttemptOffset, persistedAttemptNumber),
          );
        },
      },
    });

    const execution = options?.resumeCheckpoint
      ? await ceo.resumeFromCheckpoint(options.resumeCheckpoint, options.userInputValues ?? {})
      : await ceo.execute({
          projectId,
          workflowRunId,
          projectIdea: idea,
          projectContext: contextForExecution,
          userInputValues: options?.userInputValues,
        });

    if (execution.outcome === "paused" && execution.checkpoint && execution.userInputRequest) {
      await persistCheckpoint(execution.checkpoint);
      await persistence.workflowRuns.update(workflowRunId, {
        status: mapWorkflowStatusToPersistence("waiting_for_user"),
        updatedAt: nowISO(),
      });
      await persistence.projects.update(projectId, {
        status: "running",
        sanitizedErrorMessage: null,
        errorCode: null,
      });
      await persistence.workflowTasks.upsert({
        id: makeTaskId(workflowRunId, execution.checkpoint.currentTaskId),
        workflowRunId,
        projectId,
        agentId: execution.userInputRequest.agentId,
        status: mapTaskStatusToPersistence("waiting_for_user"),
        startedAt: execution.checkpoint.createdAt,
      });
      return;
    }

    await persistence.checkpoints.clear(workflowRunId);

    const failedTask = execution.tasks.find((entry) => !entry.result?.success);

    if (!execution.success && !failedTask) {
      const sanitized = execution.error ? sanitizeErrorMessage(execution.error) : "Execution failed.";
      transitionWorkflow("failed");
      await persistence.workflowRuns.update(workflowRunId, {
        status: mapWorkflowStatusToPersistence(workflowState.status),
        progress: 100,
        completedAt: nowISO(),
      });
      await persistence.projects.update(projectId, {
        status: "failed",
        completedAt: nowISO(),
        sanitizedErrorMessage: sanitized,
        errorCode: "WORKFLOW_BLOCKED",
      });
      return;
    }

    if (failedTask) {
      const sanitized = failedTask.result?.error ? sanitizeErrorMessage(failedTask.result.error) : "Execution failed.";
      transitionWorkflow("failed");
      await persistence.workflowRuns.update(workflowRunId, {
        status: mapWorkflowStatusToPersistence(workflowState.status),
        progress: 100,
        completedAt: nowISO(),
      });
      await persistence.projects.update(projectId, {
        status: "failed",
        completedAt: nowISO(),
        sanitizedErrorMessage: sanitized,
        errorCode: "AGENT_EXECUTION_FAILED",
      });
      return;
    }

    const businessPlanArtifact = await loadLatestBusinessPlan(projectId, workflowRunId);
    const marketResearchArtifact = await loadLatestMarketResearchReport(projectId, workflowRunId);
    const financialModelArtifact = await loadLatestFinancialModel(projectId, workflowRunId);
    if (!businessPlanArtifact || !marketResearchArtifact || !financialModelArtifact) {
      transitionWorkflow("failed");
      await persistence.workflowRuns.update(workflowRunId, {
        status: mapWorkflowStatusToPersistence(workflowState.status),
        progress: 100,
        completedAt: nowISO(),
      });
      await persistence.projects.update(projectId, {
        status: "failed",
        completedAt: nowISO(),
        sanitizedErrorMessage: "Validated artifacts missing after execution.",
        errorCode: "ARTIFACT_MISSING",
      });
      return;
    }

    const artifactsForScore = await persistence.artifacts.list(projectId);
    const projectScore = calculateProjectScore({
      context: contextForExecution,
      artifacts: artifactsForScore,
      generatedAt: nowISO(),
    });

    await persistence.artifacts.save({
      projectId,
      workflowRunId,
      taskId: undefined,
      agentId: "ceo_orchestrator",
      pipelineId: PIPELINE_ID,
      outputType: "ProjectScore",
      content: projectScore,
      validationStatus: "valid",
      version: 1,
      schemaVersion: 1,
      artifactVersion: 1,
    });

    transitionWorkflow("completed");
    await persistence.workflowRuns.update(workflowRunId, {
      status: mapWorkflowStatusToPersistence(workflowState.status),
      progress: 100,
      completedAt: nowISO(),
    });
    await persistence.projects.update(projectId, {
      status: "completed",
      completedAt: nowISO(),
      sanitizedErrorMessage: null,
      errorCode: null,
    });
  } catch (error: unknown) {
    const sanitized = sanitizeErrorMessage(error);
    transitionWorkflow("failed");
    await persistence.workflowRuns.update(workflowRunId, {
      status: mapWorkflowStatusToPersistence(workflowState.status),
      progress: 100,
      completedAt: nowISO(),
    });
    await persistence.projects.update(projectId, {
      status: "failed",
      completedAt: nowISO(),
      sanitizedErrorMessage: sanitized,
      errorCode: "WORKFLOW_EXECUTION_FAILED",
    });
  }
}
