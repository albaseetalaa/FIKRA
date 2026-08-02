import type { ArtifactRecord, ArtifactStore } from "../../../ai/store/artifactStore";
import { InMemoryArtifactStore } from "../../../ai/store/inMemoryStore";
import type {
  AttemptRepository,
  PersistenceContainer,
  ProjectRepository,
  RequestWorkflowResumeRepository,
  RequestWorkflowResumeTarget,
  WorkflowCheckpointRepository,
  WorkflowRunRepository,
  WorkflowTaskRepository,
} from "../interfaces";
import type { AttemptRecord, ExecutionStatus, ProjectRecord, WorkflowCheckpointRecord, WorkflowRunRecord, WorkflowTaskRecord } from "../types";

function nowIso() {
  return new Date().toISOString();
}

type ProjectPatch = Partial<Omit<ProjectRecord, "id" | "createdAt">>;

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function applyUnscopedTenantInvariants(current: ProjectRecord, patch: ProjectPatch): void {
  if (hasOwn(patch, "organizationId")) {
    const next = patch.organizationId;
    if (next === undefined) {
      throw new Error("organizationId must not be explicitly set to undefined.");
    }
    if (current.organizationId !== null && next !== current.organizationId) {
      throw new Error("organizationId is immutable once set.");
    }
  }

  if (hasOwn(patch, "createdBy")) {
    const next = patch.createdBy;
    if (next === undefined) {
      throw new Error("createdBy must not be explicitly set to undefined.");
    }
    if (current.createdBy !== null && next !== current.createdBy && next !== null) {
      throw new Error("createdBy cannot be reassigned to a different non-null user.");
    }
  }
}

export class InMemoryProjectRepository implements ProjectRepository {
  private items = new Map<string, ProjectRecord>();

  async create(input: {
    id: string;
    name: string;
    idea: string;
    activePipelineId: string;
    metadata?: Record<string, unknown> | null;
    organizationId?: string | null;
    createdBy?: string | null;
  }): Promise<ProjectRecord> {
    const now = nowIso();
    const record: ProjectRecord = {
      id: input.id,
      name: input.name,
      idea: input.idea,
      metadata: input.metadata ?? null,
      status: "queued",
      activePipelineId: input.activePipelineId,
      organizationId: input.organizationId ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      errorCode: null,
      sanitizedErrorMessage: null,
    };
    this.items.set(record.id, record);
    return record;
  }

  async getById(id: string): Promise<ProjectRecord | null> {
    return this.items.get(id) ?? null;
  }

  async list(limit?: number): Promise<ProjectRecord[]> {
    const sorted = Array.from(this.items.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (typeof limit === "number") return sorted.slice(0, limit);
    return sorted;
  }

  async update(id: string, patch: ProjectPatch): Promise<ProjectRecord | null> {
    const current = this.items.get(id);
    if (!current) return null;

    applyUnscopedTenantInvariants(current, patch);

    const next: ProjectRecord = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    this.items.set(id, next);
    return next;
  }

  scopedToCreator(createdBy: string): ProjectRepository {
    return new CreatorScopedInMemoryProjectRepository(this.items, createdBy);
  }
}

class CreatorScopedInMemoryProjectRepository implements ProjectRepository {
  constructor(
    private readonly items: Map<string, ProjectRecord>,
    private readonly createdBy: string,
  ) {}

  async create(): Promise<ProjectRecord> {
    throw new Error("Creator-scoped repositories cannot create projects; use the atomic project creation service.");
  }

  async getById(id: string): Promise<ProjectRecord | null> {
    const record = this.items.get(id);
    if (!record || record.createdBy !== this.createdBy) return null;
    return record;
  }

  async list(limit?: number): Promise<ProjectRecord[]> {
    const sorted = Array.from(this.items.values())
      .filter((item) => item.createdBy === this.createdBy)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (typeof limit === "number") return sorted.slice(0, limit);
    return sorted;
  }

  async update(id: string, patch: ProjectPatch): Promise<ProjectRecord | null> {
    const current = this.items.get(id);
    if (!current || current.createdBy !== this.createdBy) return null;

    if (hasOwn(patch, "organizationId") || hasOwn(patch, "createdBy")) {
      throw new Error("Creator-scoped repositories cannot modify organizationId or createdBy.");
    }

    const next: ProjectRecord = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    this.items.set(id, next);
    return next;
  }
}

export class InMemoryWorkflowRunRepository implements WorkflowRunRepository {
  private items = new Map<string, WorkflowRunRecord>();

  async create(input: { id: string; projectId: string; pipelineId: string; status?: ExecutionStatus; progress?: number }): Promise<WorkflowRunRecord> {
    const now = nowIso();
    const record: WorkflowRunRecord = {
      id: input.id,
      projectId: input.projectId,
      pipelineId: input.pipelineId,
      status: input.status ?? "queued",
      progress: input.progress ?? 0,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(record.id, record);
    return record;
  }

  async getById(id: string): Promise<WorkflowRunRecord | null> {
    return this.items.get(id) ?? null;
  }

  async listByProject(projectId: string): Promise<WorkflowRunRecord[]> {
    return Array.from(this.items.values())
      .filter((item) => item.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getLatestByProject(projectId: string): Promise<WorkflowRunRecord | null> {
    const items = await this.listByProject(projectId);
    return items[0] ?? null;
  }

  async update(id: string, patch: Partial<Omit<WorkflowRunRecord, "id" | "projectId" | "pipelineId" | "createdAt">>): Promise<WorkflowRunRecord | null> {
    const current = this.items.get(id);
    if (!current) return null;

    const next: WorkflowRunRecord = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    this.items.set(id, next);
    return next;
  }
}

export class InMemoryWorkflowTaskRepository implements WorkflowTaskRepository {
  private items = new Map<string, WorkflowTaskRecord>();

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
    const current = this.items.get(input.id);
    const now = nowIso();
    const record: WorkflowTaskRecord = {
      id: input.id,
      workflowRunId: input.workflowRunId,
      projectId: input.projectId,
      agentId: input.agentId,
      outputType: input.outputType ?? current?.outputType ?? null,
      providerId: input.providerId ?? current?.providerId ?? null,
      model: input.model ?? current?.model ?? null,
      status: input.status,
      dependencyIds: input.dependencyIds ?? current?.dependencyIds ?? [],
      startedAt: input.startedAt ?? current?.startedAt ?? null,
      completedAt: input.completedAt ?? current?.completedAt ?? null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    this.items.set(record.id, record);
    return record;
  }

  async getById(id: string): Promise<WorkflowTaskRecord | null> {
    return this.items.get(id) ?? null;
  }

  async listByRun(workflowRunId: string): Promise<WorkflowTaskRecord[]> {
    return Array.from(this.items.values())
      .filter((item) => item.workflowRunId === workflowRunId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

export class InMemoryAttemptRepository implements AttemptRepository {
  private items = new Map<string, AttemptRecord>();

  async create(input: Omit<AttemptRecord, "createdAt">): Promise<AttemptRecord> {
    const record: AttemptRecord = {
      ...input,
      createdAt: nowIso(),
    };
    this.items.set(record.id, record);
    return record;
  }

  async listByTask(taskId: string): Promise<AttemptRecord[]> {
    return Array.from(this.items.values())
      .filter((item) => item.taskId === taskId)
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
  }
}

export class InMemoryWorkflowCheckpointRepository implements WorkflowCheckpointRepository {
  private items = new Map<string, WorkflowCheckpointRecord>();

  async upsert(input: Omit<WorkflowCheckpointRecord, "createdAt" | "updatedAt">): Promise<WorkflowCheckpointRecord> {
    const now = nowIso();
    const current = this.items.get(input.workflowRunId);
    const next: WorkflowCheckpointRecord = {
      ...input,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    this.items.set(input.workflowRunId, next);
    return next;
  }

  async getActiveByWorkflowRunId(workflowRunId: string): Promise<WorkflowCheckpointRecord | null> {
    return this.items.get(workflowRunId) ?? null;
  }

  async consumeRequest(input: { workflowRunId: string; requestId: string; checkpointVersion: number }): Promise<WorkflowCheckpointRecord | null> {
    const current = this.items.get(input.workflowRunId);
    if (!current) return null;
    if (current.requestId !== input.requestId) return null;
    if (current.checkpointVersion !== input.checkpointVersion) return null;
    if (current.requestConsumedAt) return null;

    const now = nowIso();
    const next: WorkflowCheckpointRecord = {
      ...current,
      requestConsumedAt: now,
      checkpointVersion: current.checkpointVersion + 1,
      updatedAt: now,
    };
    this.items.set(input.workflowRunId, next);
    return next;
  }

  async clear(workflowRunId: string): Promise<void> {
    this.items.delete(workflowRunId);
  }
}

export class InMemoryArtifactStoreV2 implements ArtifactStore {
  private readonly store = new InMemoryArtifactStore();

  async save(rec: Omit<ArtifactRecord, "artifactId" | "createdAt" | "updatedAt">): Promise<ArtifactRecord> {
    return this.store.save(rec);
  }

  async get(artifactId: string): Promise<ArtifactRecord | null> {
    return this.store.get(artifactId);
  }

  async list(projectId?: string): Promise<ArtifactRecord[]> {
    return this.store.list(projectId);
  }

  async delete(artifactId: string): Promise<boolean> {
    return this.store.delete(artifactId);
  }

  async exists(artifactId: string): Promise<boolean> {
    return this.store.exists(artifactId);
  }

  clear() {
    this.store.clear();
  }
}

export function createInMemoryWorkflowResumeRepository(
  system: PersistenceContainer,
  createdBy: string,
): RequestWorkflowResumeRepository {
  return {
    async findProjectForWorkflowRun(workflowRunId: string): Promise<RequestWorkflowResumeTarget | null> {
      const run = await system.workflowRuns.getById(workflowRunId);
      if (!run) return null;

      const project = await system.projects.getById(run.projectId);
      if (!project || project.createdBy !== createdBy || project.organizationId === null) {
        return null;
      }

      return {
        workflowRunId: run.id,
        projectId: project.id,
        organizationId: project.organizationId,
      };
    },
  };
}
