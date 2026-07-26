import "../../ai/providers/setup";
import { agents } from "../../ai/agents/definitions";
import Orchestrator, { AttemptRecord as OrchestratorAttemptRecord, TaskRecord } from "../../ai/orchestrator";
import { pipelines } from "../../ai/pipelines/pipelines";
import defaultModels from "../../ai/providers/models";
import { getPersistenceContainer } from "../persistence/setup";
import type { AttemptStatus, ExecutionStatus, ProjectHistoryItem, ProjectStatusView, WorkflowRunRecord } from "../persistence/types";
import { buildProjectName, buildProjectStatusView, excerptIdea, makeAttemptId, makeProjectId, makeTaskId, makeWorkflowRunId, sanitizeErrorMessage } from "./store";

const runningProjects = new Set<string>();
const PIPELINE_ID = "business_strategist_only";

function toExecutionStatus(taskStatus: string): ExecutionStatus {
  if (taskStatus === "completed") return "completed";
  if (taskStatus === "failed") return "failed";
  return "running";
}

function inferAttemptStatus(attempt: OrchestratorAttemptRecord): AttemptStatus {
  if (attempt.error) return "failed";
  if (attempt.validation?.success === true) return "completed";
  return "running";
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

async function loadLatestBusinessPlan(projectId: string, workflowRunId: string) {
  const { artifacts } = getPersistenceContainer();
  const all = await artifacts.list(projectId);
  return all.find((item) => item.workflowRunId === workflowRunId && item.outputType === "BusinessPlan" && item.validationStatus === "valid") ?? null;
}

async function updateRunProgress(workflowRunId: string, projectId: string) {
  const persistence = getPersistenceContainer();
  const tasks = await persistence.workflowTasks.listByRun(workflowRunId);
  if (tasks.length === 0) return;

  const completed = tasks.filter((task) => task.status === "completed").length;
  const progress = Math.round((completed / tasks.length) * 100);
  await persistence.workflowRuns.update(workflowRunId, { progress, updatedAt: new Date().toISOString() });

  const project = await persistence.projects.getById(projectId);
  if (project && project.status === "queued") {
    await persistence.projects.update(projectId, { status: "running", sanitizedErrorMessage: null, errorCode: null });
  }
}

export async function createProject(idea: string) {
  const persistence = getPersistenceContainer();
  const projectId = makeProjectId();
  const project = await persistence.projects.create({
    id: projectId,
    name: buildProjectName(idea),
    idea,
    activePipelineId: PIPELINE_ID,
  });

  const run = await persistence.workflowRuns.create({
    id: makeWorkflowRunId(),
    projectId,
    pipelineId: PIPELINE_ID,
    status: "queued",
    progress: 0,
  });

  return {
    projectId: project.id,
    status: project.status,
    workflowRunId: run.id,
  };
}

export async function listProjectHistory(limit = 30): Promise<ProjectHistoryItem[]> {
  const persistence = getPersistenceContainer();
  const projects = await persistence.projects.list(limit);
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    ideaExcerpt: excerptIdea(project.idea),
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }));
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

export async function startBusinessStrategistExecution(projectId: string) {
  if (runningProjects.has(projectId)) return;

  const persistence = getPersistenceContainer();
  const project = await persistence.projects.getById(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const workflowRun = await ensureQueuedRun(projectId);
  if (!workflowRun) {
    throw new Error("No workflow run available.");
  }

  runningProjects.add(projectId);
  void runExecution(project.id, workflowRun.id, project.idea).finally(() => {
    runningProjects.delete(projectId);
  });
}

export async function getProjectStatus(projectId: string): Promise<ProjectStatusView | null> {
  const persistence = getPersistenceContainer();
  const project = await persistence.projects.getById(projectId);
  if (!project) return null;

  const run = await persistence.workflowRuns.getLatestByProject(projectId);
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
    };
  }

  const artifact = await loadLatestBusinessPlan(projectId, run.id);
  return buildProjectStatusView(project, run, artifact);
}

async function runExecution(projectId: string, workflowRunId: string, idea: string) {
  const persistence = getPersistenceContainer();
  const startedAt = new Date().toISOString();

  await persistence.projects.update(projectId, {
    status: "running",
    sanitizedErrorMessage: null,
    errorCode: null,
  });

  await persistence.workflowRuns.update(workflowRunId, {
    status: "running",
    progress: 0,
    startedAt,
  });

  try {
    const orchestrator = new Orchestrator(pipelines, agents, defaultModels, {
      onTaskChanged: async (task: TaskRecord) => {
        const status = toExecutionStatus(task.status);
        await persistence.workflowTasks.upsert({
          id: makeTaskId(workflowRunId, task.id),
          workflowRunId,
          projectId,
          agentId: task.step.agent,
          outputType: task.result?.output ? "BusinessPlan" : null,
          providerId: (task.result?.metadata?.providerId as string | undefined) ?? null,
          model: (task.result?.metadata?.model as string | undefined) ?? null,
          status,
          dependencyIds: task.step.dependsOn ?? [],
          startedAt: status === "running" ? new Date().toISOString() : undefined,
          completedAt: status === "completed" || status === "failed" ? new Date().toISOString() : undefined,
        });
        await updateRunProgress(workflowRunId, projectId);
      },
      onAttemptRecorded: async (task: TaskRecord, attempt: OrchestratorAttemptRecord) => {
        const taskId = makeTaskId(workflowRunId, task.id);
        const meta = extractAttemptMeta(attempt);
        const attemptStatus = inferAttemptStatus(attempt);
        await persistence.attempts.create({
          id: makeAttemptId(taskId, attempt.attempt),
          taskId,
          attemptNumber: attempt.attempt,
          providerId: meta.providerId,
          model: meta.model,
          status: attemptStatus,
          errorCode: attempt.error?.code ?? null,
          retryable: attempt.error?.retryable ?? false,
          latencyMs: meta.latencyMs,
          inputTokens: meta.inputTokens,
          outputTokens: meta.outputTokens,
          totalTokens: meta.totalTokens,
          startedAt: meta.startedAt,
          completedAt: meta.completedAt,
        });
      },
    });

    const tasks = await orchestrator.startPipeline(PIPELINE_ID, projectId, { projectSummary: idea }, workflowRunId);
    const task = tasks.find((entry) => entry.step.agent === "business_strategist");

    if (!task || !task.result?.success) {
      const sanitized = task?.result?.error ? sanitizeErrorMessage(task.result.error) : "Execution failed.";
      await persistence.workflowRuns.update(workflowRunId, {
        status: "failed",
        progress: 100,
        completedAt: new Date().toISOString(),
      });
      await persistence.projects.update(projectId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        sanitizedErrorMessage: sanitized,
        errorCode: "AGENT_EXECUTION_FAILED",
      });
      return;
    }

    const artifact = await loadLatestBusinessPlan(projectId, workflowRunId);
    if (!artifact) {
      await persistence.workflowRuns.update(workflowRunId, {
        status: "failed",
        progress: 100,
        completedAt: new Date().toISOString(),
      });
      await persistence.projects.update(projectId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        sanitizedErrorMessage: "Validated artifact missing after execution.",
        errorCode: "ARTIFACT_MISSING",
      });
      return;
    }

    await persistence.workflowRuns.update(workflowRunId, {
      status: "completed",
      progress: 100,
      completedAt: new Date().toISOString(),
    });
    await persistence.projects.update(projectId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      sanitizedErrorMessage: null,
      errorCode: null,
    });
  } catch (error: unknown) {
    const sanitized = sanitizeErrorMessage(error);
    await persistence.workflowRuns.update(workflowRunId, {
      status: "failed",
      progress: 100,
      completedAt: new Date().toISOString(),
    });
    await persistence.projects.update(projectId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      sanitizedErrorMessage: sanitized,
      errorCode: "WORKFLOW_EXECUTION_FAILED",
    });
  }
}
