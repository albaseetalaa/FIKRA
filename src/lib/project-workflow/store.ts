import type { ArtifactRecord } from "../../ai/store/artifactStore";
import type { ProjectRecord, ProjectStatusView, WorkflowRunRecord } from "../persistence/types";

export function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "Execution failed.");
  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}

export function makeProjectId() {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeWorkflowRunId() {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeTaskId(workflowRunId: string, rawTaskId: string) {
  return `${workflowRunId}:${rawTaskId}`;
}

export function makeAttemptId(taskId: string, attemptNumber: number) {
  return `${taskId}:a${attemptNumber}`;
}

export function buildProjectName(idea: string) {
  const words = idea.trim().split(/\s+/).slice(0, 6);
  return words.join(" ") || "New Project";
}

export function buildProjectStatusView(project: ProjectRecord, run: WorkflowRunRecord | null, businessPlanArtifact: ArtifactRecord | null): ProjectStatusView {
  return {
    projectId: project.id,
    name: project.name,
    idea: project.idea,
    status: project.status,
    currentStep: run?.status ?? project.status,
    errorMessage: project.sanitizedErrorMessage,
    startedAt: run?.startedAt ?? null,
    completedAt: project.completedAt,
    businessPlan: businessPlanArtifact?.content ?? null,
  };
}

export function excerptIdea(idea: string, length = 90) {
  const normalized = idea.replace(/\s+/g, " ").trim();
  if (normalized.length <= length) return normalized;
  return `${normalized.slice(0, length)}...`;
}
