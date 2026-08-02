import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArtifactRecord, ArtifactStore } from "../../../ai/store/artifactStore";
import type {
  AttemptRepository,
  ProjectRepository,
  RequestWorkflowResumeRepository,
  RequestWorkflowResumeTarget,
  WorkflowCheckpointRepository,
  WorkflowRunRepository,
  WorkflowTaskRepository,
} from "../interfaces";
import type { AttemptRecord, ExecutionStatus, ProjectRecord, WorkflowCheckpointRecord, WorkflowRunRecord, WorkflowTaskRecord } from "../types";

type QueryErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type QueryResult<T> = {
  data: T | null;
  error: QueryErrorLike | null;
};

export const SUPABASE_RETRY_POLICY = {
  maxAttempts: 3,
  baseDelayMs: 100,
  delayStrategy: "linear" as const,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(error: unknown): string {
  if (!error) return "unknown error";
  if (error instanceof Error) return error.message;

  const maybeObj = error as QueryErrorLike;
  const parts = [maybeObj.message, maybeObj.code ? `code=${maybeObj.code}` : undefined, maybeObj.details, maybeObj.hint].filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : String(error);
}

function isExplicitlyNonRetryableError(error: unknown): boolean {
  const maybeObj = error as QueryErrorLike | undefined;
  const code = maybeObj?.code?.toUpperCase();
  if (
    code &&
    [
      "23505", // unique_violation
      "23503", // foreign_key_violation
      "23514", // check_violation
      "22P02", // invalid_text_representation
      "22000", // data_exception (generic invalid input family)
      "28P01", // invalid_password
      "28000", // invalid_authorization_specification
      "42501", // insufficient_privilege (authz / RLS)
      "42P01", // undefined_table
      "42703", // undefined_column
      "42804", // datatype_mismatch
      "42601", // syntax_error
    ].includes(code)
  ) {
    return true;
  }

  const message = formatError(error).toLowerCase();
  return (
    message.includes("unique constraint") ||
    message.includes("duplicate key value violates unique") ||
    message.includes("foreign key constraint") ||
    message.includes("violates foreign key") ||
    message.includes("check constraint") ||
    message.includes("violates check") ||
    message.includes("invalid input") ||
    message.includes("invalid input syntax") ||
    message.includes("authentication failed") ||
    message.includes("invalid api key") ||
    message.includes("invalid jwt") ||
    message.includes("permission denied") ||
    message.includes("insufficient privilege") ||
    message.includes("row-level security") ||
    message.includes("rls") ||
    message.includes("not authorized") ||
    message.includes("forbidden") ||
    message.includes("undefined table") ||
    message.includes("undefined column") ||
    message.includes("does not exist") ||
    message.includes("schema mismatch") ||
    message.includes("schema cache") ||
    message.includes("syntax error") ||
    message.includes("malformed query") ||
    message.includes("failed to parse query") ||
    message.includes("validation error") ||
    message.includes("validation failed")
  );
}

export function isTransientSupabaseError(error: unknown): boolean {
  if (isExplicitlyNonRetryableError(error)) {
    return false;
  }

  const maybeObj = error as QueryErrorLike | undefined;
  const code = maybeObj?.code?.toUpperCase();
  if (code && ["40001", "40P01", "08000", "08001", "08006", "57P03"].includes(code)) {
    return true;
  }

  const message = formatError(error).toLowerCase();

  const transientHttpStatus = /(http|status|code)[^\d]{0,12}(429|502|503|504)\b/.test(message);
  if (transientHttpStatus) {
    return true;
  }

  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("fetch failed") ||
    message.includes("network interruption") ||
    message.includes("network error") ||
    message.includes("econnreset") ||
    message.includes("connection reset") ||
    message.includes("socket hang up") ||
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("dns") ||
    message.includes("connection refused") ||
    message.includes("could not connect") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("temporarily unavailable") ||
    message.includes("too many requests") || // HTTP 429 textual variant
    message.includes("rate limit") ||
    message.includes("deadlock") ||
    message.includes("could not serialize")
  );
}

export async function executeWithRetry<T>(query: () => PromiseLike<QueryResult<T>>): Promise<QueryResult<T>> {
  const maxAttempts = SUPABASE_RETRY_POLICY.maxAttempts;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await query();
      if (!result.error) {
        return result;
      }

      if (!isTransientSupabaseError(result.error) || attempt === maxAttempts) {
        return result;
      }
    } catch (error) {
      if (!isTransientSupabaseError(error) || attempt === maxAttempts) {
        throw error;
      }
    }

    await sleep(SUPABASE_RETRY_POLICY.baseDelayMs * attempt);
  }

  throw new Error("Transient retry failed unexpectedly.");
}

function fail(message: string, error?: unknown): never {
  if (!error) {
    throw new Error(message);
  }

  throw new Error(`${message} ${formatError(error)}`);
}

type ProjectRow = Record<string, unknown> & {
  organization_id?: string | null;
  created_by?: string | null;
};

function mapProject(row: Record<string, unknown>): ProjectRecord {
  const projectRow = row as ProjectRow;
  return {
    id: String(row.id),
    name: String(row.name),
    idea: String(row.idea),
    metadata: (row.metadata_json as Record<string, unknown> | null) ?? null,
    status: row.status as ExecutionStatus,
    activePipelineId: String(row.active_pipeline_id),
    organizationId: projectRow.organization_id ?? null,
    createdBy: projectRow.created_by ?? null,
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

function mapCheckpoint(row: Record<string, unknown>): WorkflowCheckpointRecord {
  return {
    workflowRunId: String(row.workflow_run_id),
    projectId: String(row.project_id),
    currentTaskId: String(row.current_task_id),
    workflowStatus: String(row.workflow_status),
    taskStatus: String(row.task_status),
    completedTaskIds: (row.completed_task_ids as string[] | null) ?? [],
    pendingTaskIds: (row.pending_task_ids as string[] | null) ?? [],
    dependencyState: (row.dependency_state as Record<string, string[]> | null) ?? {},
    attemptCounters: (row.attempt_counters as Record<string, number> | null) ?? {},
    executionContext: (row.execution_context as Record<string, unknown> | null) ?? {},
    userInputRequest: (row.user_input_request as Record<string, unknown> | null) ?? {},
    requestId: String(row.request_id),
    checkpointVersion: Number(row.checkpoint_version ?? 1),
    requestConsumedAt: row.request_consumed_at ? String(row.request_consumed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class SupabaseProjectRepository implements ProjectRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: {
    id: string;
    name: string;
    idea: string;
    activePipelineId: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<ProjectRecord> {
    const baseInsert = {
      id: input.id,
      name: input.name,
      idea: input.idea,
      status: "queued",
      active_pipeline_id: input.activePipelineId,
    };

    const firstAttempt = await executeWithRetry<Record<string, unknown>>(() =>
      this.db
        .from("projects")
        .insert({
          ...baseInsert,
          metadata_json: input.metadata ?? {},
        })
        .select("*")
        .single(),
    );

    if (!firstAttempt.error && firstAttempt.data) {
      return mapProject(firstAttempt.data);
    }

    if (firstAttempt.error && /metadata_json/i.test(firstAttempt.error.message ?? "")) {
      const fallback = await executeWithRetry<Record<string, unknown>>(() => this.db.from("projects").insert(baseInsert).select("*").single());
      if (!fallback.error && fallback.data) {
        return mapProject(fallback.data);
      }
      fail("Could not persist project.", fallback.error);
    }

    fail("Could not persist project.", firstAttempt.error);
  }

  async getById(id: string): Promise<ProjectRecord | null> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() => this.db.from("projects").select("*").eq("id", id).maybeSingle());
    if (error) fail("Could not fetch project.", error);
    return data ? mapProject(data) : null;
  }

  async list(limit?: number): Promise<ProjectRecord[]> {
    let query = this.db.from("projects").select("*").order("created_at", { ascending: false });
    if (typeof limit === "number") query = query.limit(limit);
    const { data, error } = await executeWithRetry<Record<string, unknown>[]>(() => query);
    if (error) fail("Could not list projects.", error);
    return (data ?? []).map(mapProject);
  }

  async update(id: string, patch: Partial<Omit<ProjectRecord, "id" | "createdAt">>): Promise<ProjectRecord | null> {
    const mapped: Record<string, unknown> = {};
    if (patch.name !== undefined) mapped.name = patch.name;
    if (patch.idea !== undefined) mapped.idea = patch.idea;
    if (patch.status !== undefined) mapped.status = patch.status;
    if (patch.activePipelineId !== undefined) mapped.active_pipeline_id = patch.activePipelineId;
    if (patch.metadata !== undefined) mapped.metadata_json = patch.metadata;
    if (patch.completedAt !== undefined) mapped.completed_at = patch.completedAt;
    if (patch.errorCode !== undefined) mapped.error_code = patch.errorCode;
    if (patch.sanitizedErrorMessage !== undefined) mapped.sanitized_error_message = patch.sanitizedErrorMessage;
    if (patch.updatedAt !== undefined) mapped.updated_at = patch.updatedAt;

    const firstAttempt = await executeWithRetry<Record<string, unknown>>(() => this.db.from("projects").update(mapped).eq("id", id).select("*").maybeSingle());
    if (!firstAttempt.error) {
      return firstAttempt.data ? mapProject(firstAttempt.data) : null;
    }

    if (patch.metadata !== undefined && /metadata_json/i.test(firstAttempt.error?.message ?? "")) {
      const { metadata: _ignoredMetadata, ...withoutMetadata } = patch;
      const retryMapped: Record<string, unknown> = {};
      if (withoutMetadata.name !== undefined) retryMapped.name = withoutMetadata.name;
      if (withoutMetadata.idea !== undefined) retryMapped.idea = withoutMetadata.idea;
      if (withoutMetadata.status !== undefined) retryMapped.status = withoutMetadata.status;
      if (withoutMetadata.activePipelineId !== undefined) retryMapped.active_pipeline_id = withoutMetadata.activePipelineId;
      if (withoutMetadata.completedAt !== undefined) retryMapped.completed_at = withoutMetadata.completedAt;
      if (withoutMetadata.errorCode !== undefined) retryMapped.error_code = withoutMetadata.errorCode;
      if (withoutMetadata.sanitizedErrorMessage !== undefined) retryMapped.sanitized_error_message = withoutMetadata.sanitizedErrorMessage;
      if (withoutMetadata.updatedAt !== undefined) retryMapped.updated_at = withoutMetadata.updatedAt;

      const fallback = await executeWithRetry<Record<string, unknown>>(() => this.db.from("projects").update(retryMapped).eq("id", id).select("*").maybeSingle());
      if (!fallback.error) {
        return fallback.data ? mapProject(fallback.data) : null;
      }
      fail("Could not update project.", fallback.error);
    }

    fail("Could not update project.", firstAttempt.error);
  }

  scopedToCreator(createdBy: string): ProjectRepository {
    return new CreatorScopedSupabaseProjectRepository(this.db, createdBy);
  }
}

class CreatorScopedSupabaseProjectRepository implements ProjectRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly createdBy: string,
  ) {}

  async create(): Promise<ProjectRecord> {
    throw new Error("Creator-scoped repositories cannot create projects; use the atomic project creation service.");
  }

  async getById(id: string): Promise<ProjectRecord | null> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() =>
      this.db.from("projects").select("*").eq("id", id).eq("created_by", this.createdBy).maybeSingle(),
    );
    if (error) fail("Could not fetch project.", error);
    return data ? mapProject(data) : null;
  }

  async list(limit?: number): Promise<ProjectRecord[]> {
    let query = this.db.from("projects").select("*").eq("created_by", this.createdBy).order("created_at", { ascending: false });
    if (typeof limit === "number") query = query.limit(limit);
    const { data, error } = await executeWithRetry<Record<string, unknown>[]>(() => query);
    if (error) fail("Could not list projects.", error);
    return (data ?? []).map(mapProject);
  }

  async update(id: string, patch: Partial<Omit<ProjectRecord, "id" | "createdAt">>): Promise<ProjectRecord | null> {
    if (Object.prototype.hasOwnProperty.call(patch, "organizationId") || Object.prototype.hasOwnProperty.call(patch, "createdBy")) {
      throw new Error("Creator-scoped repositories cannot modify organizationId or createdBy.");
    }

    const mapped: Record<string, unknown> = {};
    if (patch.name !== undefined) mapped.name = patch.name;
    if (patch.idea !== undefined) mapped.idea = patch.idea;
    if (patch.status !== undefined) mapped.status = patch.status;
    if (patch.activePipelineId !== undefined) mapped.active_pipeline_id = patch.activePipelineId;
    if (patch.metadata !== undefined) mapped.metadata_json = patch.metadata;
    if (patch.completedAt !== undefined) mapped.completed_at = patch.completedAt;
    if (patch.errorCode !== undefined) mapped.error_code = patch.errorCode;
    if (patch.sanitizedErrorMessage !== undefined) mapped.sanitized_error_message = patch.sanitizedErrorMessage;
    if (patch.updatedAt !== undefined) mapped.updated_at = patch.updatedAt;

    const firstAttempt = await executeWithRetry<Record<string, unknown>>(() =>
      this.db.from("projects").update(mapped).eq("id", id).eq("created_by", this.createdBy).select("*").maybeSingle(),
    );
    if (!firstAttempt.error) {
      return firstAttempt.data ? mapProject(firstAttempt.data) : null;
    }

    if (patch.metadata !== undefined && /metadata_json/i.test(firstAttempt.error?.message ?? "")) {
      const { metadata: _ignoredMetadata, ...withoutMetadata } = patch;
      const retryMapped: Record<string, unknown> = {};
      if (withoutMetadata.name !== undefined) retryMapped.name = withoutMetadata.name;
      if (withoutMetadata.idea !== undefined) retryMapped.idea = withoutMetadata.idea;
      if (withoutMetadata.status !== undefined) retryMapped.status = withoutMetadata.status;
      if (withoutMetadata.activePipelineId !== undefined) retryMapped.active_pipeline_id = withoutMetadata.activePipelineId;
      if (withoutMetadata.completedAt !== undefined) retryMapped.completed_at = withoutMetadata.completedAt;
      if (withoutMetadata.errorCode !== undefined) retryMapped.error_code = withoutMetadata.errorCode;
      if (withoutMetadata.sanitizedErrorMessage !== undefined) retryMapped.sanitized_error_message = withoutMetadata.sanitizedErrorMessage;
      if (withoutMetadata.updatedAt !== undefined) retryMapped.updated_at = withoutMetadata.updatedAt;

      const fallback = await executeWithRetry<Record<string, unknown>>(() =>
        this.db.from("projects").update(retryMapped).eq("id", id).eq("created_by", this.createdBy).select("*").maybeSingle(),
      );
      if (!fallback.error) {
        return fallback.data ? mapProject(fallback.data) : null;
      }
      fail("Could not update project.", fallback.error);
    }

    fail("Could not update project.", firstAttempt.error);
  }
}

export class SupabaseWorkflowRunRepository implements WorkflowRunRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: { id: string; projectId: string; pipelineId: string; status?: ExecutionStatus; progress?: number }): Promise<WorkflowRunRecord> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() =>
      this.db
        .from("workflow_runs")
        .insert({
          id: input.id,
          project_id: input.projectId,
          pipeline_id: input.pipelineId,
          status: input.status ?? "queued",
          progress: input.progress ?? 0,
        })
        .select("*")
        .single(),
    );
    if (error || !data) fail("Could not create workflow run.", error);
    return mapRun(data);
  }

  async getById(id: string): Promise<WorkflowRunRecord | null> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() => this.db.from("workflow_runs").select("*").eq("id", id).maybeSingle());
    if (error) fail("Could not fetch workflow run.", error);
    return data ? mapRun(data) : null;
  }

  async listByProject(projectId: string): Promise<WorkflowRunRecord[]> {
    const { data, error } = await executeWithRetry<Record<string, unknown>[]>(() => this.db.from("workflow_runs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }));
    if (error) fail("Could not list workflow runs.", error);
    return (data ?? []).map(mapRun);
  }

  async getLatestByProject(projectId: string): Promise<WorkflowRunRecord | null> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() =>
      this.db
        .from("workflow_runs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    if (error) fail("Could not fetch latest workflow run.", error);
    return data ? mapRun(data) : null;
  }

  async update(id: string, patch: Partial<Omit<WorkflowRunRecord, "id" | "projectId" | "pipelineId" | "createdAt">>): Promise<WorkflowRunRecord | null> {
    const mapped: Record<string, unknown> = {};
    if (patch.status !== undefined) mapped.status = patch.status;
    if (patch.progress !== undefined) mapped.progress = patch.progress;
    if (patch.startedAt !== undefined) mapped.started_at = patch.startedAt;
    if (patch.completedAt !== undefined) mapped.completed_at = patch.completedAt;
    if (patch.updatedAt !== undefined) mapped.updated_at = patch.updatedAt;

    const { data, error } = await executeWithRetry<Record<string, unknown>>(() => this.db.from("workflow_runs").update(mapped).eq("id", id).select("*").maybeSingle());
    if (error) fail("Could not update workflow run.", error);
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
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() =>
      this.db
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
        .single(),
    );

    if (error || !data) fail("Could not upsert workflow task.", error);
    return mapTask(data);
  }

  async getById(id: string): Promise<WorkflowTaskRecord | null> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() => this.db.from("workflow_tasks").select("*").eq("id", id).maybeSingle());
    if (error) fail("Could not fetch workflow task.", error);
    return data ? mapTask(data) : null;
  }

  async listByRun(workflowRunId: string): Promise<WorkflowTaskRecord[]> {
    const { data, error } = await executeWithRetry<Record<string, unknown>[]>(() =>
      this.db
        .from("workflow_tasks")
        .select("*")
        .eq("workflow_run_id", workflowRunId)
        .order("created_at", { ascending: true }),
    );
    if (error) fail("Could not list workflow tasks.", error);
    return (data ?? []).map(mapTask);
  }
}

export class SupabaseAttemptRepository implements AttemptRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: Omit<AttemptRecord, "createdAt">): Promise<AttemptRecord> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() =>
      this.db
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
        .single(),
    );

    if (error || !data) fail("Could not persist attempt.", error);
    return mapAttempt(data);
  }

  async listByTask(taskId: string): Promise<AttemptRecord[]> {
    const { data, error } = await executeWithRetry<Record<string, unknown>[]>(() =>
      this.db
        .from("attempts")
        .select("*")
        .eq("task_id", taskId)
        .order("attempt_number", { ascending: true }),
    );
    if (error) fail("Could not list attempts.", error);
    return (data ?? []).map(mapAttempt);
  }
}

export class SupabaseArtifactStore implements ArtifactStore {
  constructor(private readonly db: SupabaseClient) {}

  async save(rec: Omit<ArtifactRecord, "artifactId" | "createdAt" | "updatedAt">): Promise<ArtifactRecord> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() =>
      this.db
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
        .single(),
    );

    if (error || !data) fail("Could not persist artifact.", error);
    return mapArtifact(data);
  }

  async get(artifactId: string): Promise<ArtifactRecord | null> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() => this.db.from("artifacts").select("*").eq("id", artifactId).maybeSingle());
    if (error) fail("Could not fetch artifact.", error);
    return data ? mapArtifact(data) : null;
  }

  async list(projectId?: string): Promise<ArtifactRecord[]> {
    let query = this.db.from("artifacts").select("*").order("created_at", { ascending: false });
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await executeWithRetry<Record<string, unknown>[]>(() => query);
    if (error) fail("Could not list artifacts.", error);
    return (data ?? []).map(mapArtifact);
  }

  async delete(artifactId: string): Promise<boolean> {
    const { error } = await executeWithRetry<null>(() => this.db.from("artifacts").delete().eq("id", artifactId));
    if (error) fail("Could not delete artifact.", error);
    return true;
  }

  async exists(artifactId: string): Promise<boolean> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() => this.db.from("artifacts").select("id").eq("id", artifactId).maybeSingle());
    if (error) fail("Could not check artifact existence.", error);
    return Boolean(data);
  }
}

export class SupabaseWorkflowCheckpointRepository implements WorkflowCheckpointRepository {
  constructor(private readonly db: SupabaseClient) {}

  async upsert(input: Omit<WorkflowCheckpointRecord, "createdAt" | "updatedAt">): Promise<WorkflowCheckpointRecord> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() =>
      this.db
        .from("workflow_checkpoints")
        .upsert(
          {
            workflow_run_id: input.workflowRunId,
            project_id: input.projectId,
            current_task_id: input.currentTaskId,
            workflow_status: input.workflowStatus,
            task_status: input.taskStatus,
            completed_task_ids: input.completedTaskIds,
            pending_task_ids: input.pendingTaskIds,
            dependency_state: input.dependencyState,
            attempt_counters: input.attemptCounters,
            execution_context: input.executionContext,
            user_input_request: input.userInputRequest,
            request_id: input.requestId,
            checkpoint_version: input.checkpointVersion,
            request_consumed_at: input.requestConsumedAt,
          },
          { onConflict: "workflow_run_id" },
        )
        .select("*")
        .single(),
    );

    if (error || !data) fail("Could not persist workflow checkpoint.", error);
    return mapCheckpoint(data);
  }

  async getActiveByWorkflowRunId(workflowRunId: string): Promise<WorkflowCheckpointRecord | null> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() => this.db.from("workflow_checkpoints").select("*").eq("workflow_run_id", workflowRunId).maybeSingle());
    if (error) fail("Could not fetch workflow checkpoint.", error);
    return data ? mapCheckpoint(data) : null;
  }

  async consumeRequest(input: { workflowRunId: string; requestId: string; checkpointVersion: number }): Promise<WorkflowCheckpointRecord | null> {
    const { data, error } = await executeWithRetry<Record<string, unknown>>(() =>
      this.db
        .from("workflow_checkpoints")
        .update({
          request_consumed_at: new Date().toISOString(),
          checkpoint_version: input.checkpointVersion + 1,
        })
        .eq("workflow_run_id", input.workflowRunId)
        .eq("request_id", input.requestId)
        .eq("checkpoint_version", input.checkpointVersion)
        .is("request_consumed_at", null)
        .select("*")
        .maybeSingle(),
    );

    if (error) fail("Could not consume resume request.", error);
    return data ? mapCheckpoint(data) : null;
  }

  async clear(workflowRunId: string): Promise<void> {
    const { error } = await executeWithRetry<null>(() => this.db.from("workflow_checkpoints").delete().eq("workflow_run_id", workflowRunId));
    if (error) fail("Could not clear workflow checkpoint.", error);
  }
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseWorkflowResumeRow(row: unknown, createdBy: string): RequestWorkflowResumeTarget | null {
  if (row === null || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("Could not resolve workflow resume authorization data.", { cause: row });
  }

  const candidate = row as Record<string, unknown>;
  const projectRelation = candidate.projects;

  if (projectRelation === null || typeof projectRelation !== "object" || Array.isArray(projectRelation)) {
    throw new Error("Could not resolve workflow resume authorization data.", { cause: row });
  }

  const projectCandidate = projectRelation as Record<string, unknown>;

  if (!isNonBlankString(candidate.id) || !isNonBlankString(candidate.project_id)) {
    throw new Error("Could not resolve workflow resume authorization data.", { cause: row });
  }

  if (projectCandidate.created_by !== createdBy) {
    return null;
  }

  if (!isNonBlankString(projectCandidate.organization_id)) {
    return null;
  }

  return {
    workflowRunId: candidate.id,
    projectId: candidate.project_id,
    organizationId: projectCandidate.organization_id,
  };
}

export function createSupabaseWorkflowResumeRepository(db: SupabaseClient, createdBy: string): RequestWorkflowResumeRepository {
  return {
    async findProjectForWorkflowRun(workflowRunId: string): Promise<RequestWorkflowResumeTarget | null> {
      const { data, error } = await executeWithRetry<Record<string, unknown>>(() =>
        db
          .from("workflow_runs")
          .select("id, project_id, projects!inner(organization_id, created_by)")
          .eq("id", workflowRunId)
          .eq("projects.created_by", createdBy)
          .not("projects.organization_id", "is", null)
          .maybeSingle(),
      );

      if (error) fail("Could not resolve workflow resume authorization.", error);
      if (!data) return null;

      return parseWorkflowResumeRow(data, createdBy);
    },
  };
}
