import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArtifactRecord, ArtifactStore } from "../../../ai/store/artifactStore";
import type { AttemptRepository, ProjectRepository, WorkflowRunRepository, WorkflowTaskRepository } from "../interfaces";
import type { AttemptRecord, ExecutionStatus, ProjectRecord, WorkflowRunRecord, WorkflowTaskRecord } from "../types";

function fail(message: string): never {
  throw new Error(message);
}

function mapProject(row: Record<string, unknown>): ProjectRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    idea: String(row.idea),
    status: row.status as ExecutionStatus,
    activePipelineId: String(row.active_pipeline_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    errorCode: row.error_code ? String(row.error_code) : null,
    sanitizedErrorMessage: row.sanitized_error_message ? String(row.sanitized_error_message) : null,
  };
}

function mapRun(row: Record<string, unknown>): WorkflowRunRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    pipelineId: String(row.pipeline_id),
    status: row.status as ExecutionStatus,
    progress: Number(row.progress ?? 0),
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapTask(row: Record<string, unknown>): WorkflowTaskRecord {
  return {
    id: String(row.id),
    workflowRunId: String(row.workflow_run_id),
    projectId: String(row.project_id),
    agentId: String(row.agent_id),
    outputType: row.output_type ? String(row.output_type) : null,
    providerId: row.provider_id ? String(row.provider_id) : null,
    model: row.model ? String(row.model) : null,
    status: row.status as ExecutionStatus,
    dependencyIds: (row.dependency_ids as string[] | null) ?? [],
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapAttempt(row: Record<string, unknown>): AttemptRecord {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    attemptNumber: Number(row.attempt_number),
    providerId: row.provider_id ? String(row.provider_id) : null,
    model: row.model ? String(row.model) : null,
    status: row.status as AttemptRecord["status"],
    errorCode: row.error_code ? String(row.error_code) : null,
    retryable: Boolean(row.retryable),
    latencyMs: row.latency_ms == null ? null : Number(row.latency_ms),
    inputTokens: row.input_tokens == null ? null : Number(row.input_tokens),
    outputTokens: row.output_tokens == null ? null : Number(row.output_tokens),
    totalTokens: row.total_tokens == null ? null : Number(row.total_tokens),
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
  };
}

function mapArtifact(row: Record<string, unknown>): ArtifactRecord {
  return {
    artifactId: String(row.id),
    projectId: String(row.project_id),
    workflowRunId: row.workflow_run_id ? String(row.workflow_run_id) : undefined,
    taskId: row.task_id ? String(row.task_id) : undefined,
    agentId: String(row.agent_id),
    pipelineId: row.pipeline_id ? String(row.pipeline_id) : undefined,
    outputType: String(row.output_type),
    content: row.content_json,
    validationStatus: row.validation_status as "valid" | "invalid",
    version: Number(row.artifact_version ?? 1),
    schemaVersion: Number(row.schema_version ?? 1),
    artifactVersion: Number(row.artifact_version ?? 1),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class SupabaseProjectRepository implements ProjectRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: { id: string; name: string; idea: string; activePipelineId: string }): Promise<ProjectRecord> {
    const { data, error } = await this.db
      .from("projects")
      .insert({
        id: input.id,
        name: input.name,
        idea: input.idea,
        status: "queued",
        active_pipeline_id: input.activePipelineId,
      })
      .select("*")
      .single();

    if (error || !data) fail("Could not persist project.");
    return mapProject(data);
  }

  async getById(id: string): Promise<ProjectRecord | null> {
    const { data, error } = await this.db.from("projects").select("*").eq("id", id).maybeSingle();
    if (error) fail("Could not fetch project.");
    return data ? mapProject(data) : null;
  }

  async list(limit?: number): Promise<ProjectRecord[]> {
    let query = this.db.from("projects").select("*").order("created_at", { ascending: false });
    if (typeof limit === "number") query = query.limit(limit);
    const { data, error } = await query;
    if (error) fail("Could not list projects.");
    return (data ?? []).map(mapProject);
  }

  async update(id: string, patch: Partial<Omit<ProjectRecord, "id" | "createdAt">>): Promise<ProjectRecord | null> {
    const mapped: Record<string, unknown> = {};
    if (patch.name !== undefined) mapped.name = patch.name;
    if (patch.idea !== undefined) mapped.idea = patch.idea;
    if (patch.status !== undefined) mapped.status = patch.status;
    if (patch.activePipelineId !== undefined) mapped.active_pipeline_id = patch.activePipelineId;
    if (patch.completedAt !== undefined) mapped.completed_at = patch.completedAt;
    if (patch.errorCode !== undefined) mapped.error_code = patch.errorCode;
    if (patch.sanitizedErrorMessage !== undefined) mapped.sanitized_error_message = patch.sanitizedErrorMessage;
    if (patch.updatedAt !== undefined) mapped.updated_at = patch.updatedAt;

    const { data, error } = await this.db.from("projects").update(mapped).eq("id", id).select("*").maybeSingle();
    if (error) fail("Could not update project.");
    return data ? mapProject(data) : null;
  }
}

export class SupabaseWorkflowRunRepository implements WorkflowRunRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: { id: string; projectId: string; pipelineId: string; status?: ExecutionStatus; progress?: number }): Promise<WorkflowRunRecord> {
    const { data, error } = await this.db
      .from("workflow_runs")
      .insert({
        id: input.id,
        project_id: input.projectId,
        pipeline_id: input.pipelineId,
        status: input.status ?? "queued",
        progress: input.progress ?? 0,
      })
      .select("*")
      .single();
    if (error || !data) fail("Could not create workflow run.");
    return mapRun(data);
  }

  async getById(id: string): Promise<WorkflowRunRecord | null> {
    const { data, error } = await this.db.from("workflow_runs").select("*").eq("id", id).maybeSingle();
    if (error) fail("Could not fetch workflow run.");
    return data ? mapRun(data) : null;
  }

  async listByProject(projectId: string): Promise<WorkflowRunRecord[]> {
    const { data, error } = await this.db.from("workflow_runs").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) fail("Could not list workflow runs.");
    return (data ?? []).map(mapRun);
  }

  async getLatestByProject(projectId: string): Promise<WorkflowRunRecord | null> {
    const { data, error } = await this.db
      .from("workflow_runs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("Could not fetch latest workflow run.");
    return data ? mapRun(data) : null;
  }

  async update(id: string, patch: Partial<Omit<WorkflowRunRecord, "id" | "projectId" | "pipelineId" | "createdAt">>): Promise<WorkflowRunRecord | null> {
    const mapped: Record<string, unknown> = {};
    if (patch.status !== undefined) mapped.status = patch.status;
    if (patch.progress !== undefined) mapped.progress = patch.progress;
    if (patch.startedAt !== undefined) mapped.started_at = patch.startedAt;
    if (patch.completedAt !== undefined) mapped.completed_at = patch.completedAt;
    if (patch.updatedAt !== undefined) mapped.updated_at = patch.updatedAt;

    const { data, error } = await this.db.from("workflow_runs").update(mapped).eq("id", id).select("*").maybeSingle();
    if (error) fail("Could not update workflow run.");
    return data ? mapRun(data) : null;
  }
}

export class SupabaseWorkflowTaskRepository implements WorkflowTaskRepository {
  constructor(private readonly db: SupabaseClient) {}

  async upsert(input: {
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
  }): Promise<WorkflowTaskRecord> {
    const { data, error } = await this.db
      .from("workflow_tasks")
      .upsert(
        {
          id: input.id,
          workflow_run_id: input.workflowRunId,
          project_id: input.projectId,
          agent_id: input.agentId,
          output_type: input.outputType ?? null,
          provider_id: input.providerId ?? null,
          model: input.model ?? null,
          status: input.status,
          dependency_ids: input.dependencyIds ?? [],
          started_at: input.startedAt ?? null,
          completed_at: input.completedAt ?? null,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (error || !data) fail("Could not upsert workflow task.");
    return mapTask(data);
  }

  async getById(id: string): Promise<WorkflowTaskRecord | null> {
    const { data, error } = await this.db.from("workflow_tasks").select("*").eq("id", id).maybeSingle();
    if (error) fail("Could not fetch workflow task.");
    return data ? mapTask(data) : null;
  }

  async listByRun(workflowRunId: string): Promise<WorkflowTaskRecord[]> {
    const { data, error } = await this.db
      .from("workflow_tasks")
      .select("*")
      .eq("workflow_run_id", workflowRunId)
      .order("created_at", { ascending: true });
    if (error) fail("Could not list workflow tasks.");
    return (data ?? []).map(mapTask);
  }
}

export class SupabaseAttemptRepository implements AttemptRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: Omit<AttemptRecord, "createdAt">): Promise<AttemptRecord> {
    const { data, error } = await this.db
      .from("attempts")
      .insert({
        id: input.id,
        task_id: input.taskId,
        attempt_number: input.attemptNumber,
        provider_id: input.providerId,
        model: input.model,
        status: input.status,
        error_code: input.errorCode,
        retryable: input.retryable,
        latency_ms: input.latencyMs,
        input_tokens: input.inputTokens,
        output_tokens: input.outputTokens,
        total_tokens: input.totalTokens,
        started_at: input.startedAt,
        completed_at: input.completedAt,
      })
      .select("*")
      .single();

    if (error || !data) fail("Could not persist attempt.");
    return mapAttempt(data);
  }

  async listByTask(taskId: string): Promise<AttemptRecord[]> {
    const { data, error } = await this.db
      .from("attempts")
      .select("*")
      .eq("task_id", taskId)
      .order("attempt_number", { ascending: true });
    if (error) fail("Could not list attempts.");
    return (data ?? []).map(mapAttempt);
  }
}

export class SupabaseArtifactStore implements ArtifactStore {
  constructor(private readonly db: SupabaseClient) {}

  async save(rec: Omit<ArtifactRecord, "artifactId" | "createdAt" | "updatedAt">): Promise<ArtifactRecord> {
    const { data, error } = await this.db
      .from("artifacts")
      .insert({
        project_id: rec.projectId,
        workflow_run_id: rec.workflowRunId ?? null,
        task_id: rec.taskId ?? null,
        agent_id: rec.agentId,
        pipeline_id: rec.pipelineId ?? null,
        output_type: rec.outputType,
        content_json: rec.content,
        validation_status: rec.validationStatus,
        schema_version: rec.schemaVersion ?? 1,
        artifact_version: rec.artifactVersion ?? rec.version,
      })
      .select("*")
      .single();

    if (error || !data) fail("Could not persist artifact.");
    return mapArtifact(data);
  }

  async get(artifactId: string): Promise<ArtifactRecord | null> {
    const { data, error } = await this.db.from("artifacts").select("*").eq("id", artifactId).maybeSingle();
    if (error) fail("Could not fetch artifact.");
    return data ? mapArtifact(data) : null;
  }

  async list(projectId?: string): Promise<ArtifactRecord[]> {
    let query = this.db.from("artifacts").select("*").order("created_at", { ascending: false });
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) fail("Could not list artifacts.");
    return (data ?? []).map(mapArtifact);
  }

  async delete(artifactId: string): Promise<boolean> {
    const { error } = await this.db.from("artifacts").delete().eq("id", artifactId);
    if (error) fail("Could not delete artifact.");
    return true;
  }

  async exists(artifactId: string): Promise<boolean> {
    const { data, error } = await this.db.from("artifacts").select("id").eq("id", artifactId).maybeSingle();
    if (error) fail("Could not check artifact existence.");
    return Boolean(data);
  }
}
