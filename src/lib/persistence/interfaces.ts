import type { ArtifactStore } from "../../ai/store/artifactStore";
import type { AttemptRecord, ExecutionStatus, ProjectRecord, WorkflowCheckpointRecord, WorkflowRunRecord, WorkflowTaskRecord } from "./types";

export interface ProjectRepository {
  create(input: {
    id: string;
    name: string;
    idea: string;
    activePipelineId: string;
    metadata?: Record<string, unknown> | null;
    organizationId?: string | null;
    createdBy?: string | null;
  }): Promise<ProjectRecord>;
  getById(id: string): Promise<ProjectRecord | null>;
  list(limit?: number): Promise<ProjectRecord[]>;
  update(id: string, patch: Partial<Omit<ProjectRecord, "id" | "createdAt">>): Promise<ProjectRecord | null>;
}

export interface RequestProjectRepository {
  getById(id: string): Promise<ProjectRecord | null>;
  list(limit?: number): Promise<ProjectRecord[]>;
}

export interface RequestWorkflowResumeTarget {
  workflowRunId: string;
  projectId: string;
  organizationId: string;
}

export interface RequestWorkflowResumeRepository {
  findProjectForWorkflowRun(workflowRunId: string): Promise<RequestWorkflowResumeTarget | null>;
}

export interface ScopableProjectRepository extends ProjectRepository {
  scopedToCreator(createdBy: string): RequestProjectRepository;
}

export interface WorkflowRunRepository {
  create(input: { id: string; projectId: string; pipelineId: string; status?: ExecutionStatus; progress?: number }): Promise<WorkflowRunRecord>;
  getById(id: string): Promise<WorkflowRunRecord | null>;
  listByProject(projectId: string): Promise<WorkflowRunRecord[]>;
  getLatestByProject(projectId: string): Promise<WorkflowRunRecord | null>;
  update(id: string, patch: Partial<Omit<WorkflowRunRecord, "id" | "projectId" | "pipelineId" | "createdAt">>): Promise<WorkflowRunRecord | null>;
}

export interface WorkflowTaskRepository {
  upsert(input: {
    id: string;
    workflowRunId: string;
    projectId: string;
    agentId: string;
    outputType?: string | null;
    providerId?: string | null;
    model?: string | null;
    status: ExecutionStatus;
    dependencyIds?: string[];
    startedAt?: string | null;
    completedAt?: string | null;
  }): Promise<WorkflowTaskRecord>;
  getById(id: string): Promise<WorkflowTaskRecord | null>;
  listByRun(workflowRunId: string): Promise<WorkflowTaskRecord[]>;
}

export interface AttemptRepository {
  create(input: Omit<AttemptRecord, "createdAt">): Promise<AttemptRecord>;
  listByTask(taskId: string): Promise<AttemptRecord[]>;
}

export interface WorkflowCheckpointRepository {
  upsert(input: Omit<WorkflowCheckpointRecord, "createdAt" | "updatedAt">): Promise<WorkflowCheckpointRecord>;
  getActiveByWorkflowRunId(workflowRunId: string): Promise<WorkflowCheckpointRecord | null>;
  consumeRequest(input: {
    workflowRunId: string;
    requestId: string;
    checkpointVersion: number;
  }): Promise<WorkflowCheckpointRecord | null>;
  clear(workflowRunId: string): Promise<void>;
}

export interface PersistenceContainer {
  provider: "memory" | "supabase";
  projects: ScopableProjectRepository;
  workflowRuns: WorkflowRunRepository;
  workflowTasks: WorkflowTaskRepository;
  attempts: AttemptRepository;
  checkpoints: WorkflowCheckpointRepository;
  artifacts: ArtifactStore;
}

export interface RequestPersistenceContainer {
  projects: RequestProjectRepository;
  workflowResume: RequestWorkflowResumeRepository;
}
