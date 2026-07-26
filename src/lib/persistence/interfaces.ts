import type { ArtifactStore } from "../../ai/store/artifactStore";
import type { AttemptRecord, ExecutionStatus, ProjectRecord, WorkflowRunRecord, WorkflowTaskRecord } from "./types";

export interface ProjectRepository {
  create(input: { id: string; name: string; idea: string; activePipelineId: string }): Promise<ProjectRecord>;
  getById(id: string): Promise<ProjectRecord | null>;
  list(limit?: number): Promise<ProjectRecord[]>;
  update(id: string, patch: Partial<Omit<ProjectRecord, "id" | "createdAt">>): Promise<ProjectRecord | null>;
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

export interface PersistenceContainer {
  provider: "memory" | "supabase";
  projects: ProjectRepository;
  workflowRuns: WorkflowRunRepository;
  workflowTasks: WorkflowTaskRepository;
  attempts: AttemptRepository;
  artifacts: ArtifactStore;
}
