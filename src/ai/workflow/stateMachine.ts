export type WorkflowStatus =
  | "planning"
  | "running"
  | "retrying"
  | "waiting_for_user"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskStatus =
  | "pending"
  | "ready"
  | "running"
  | "retrying"
  | "waiting_for_user"
  | "completed"
  | "failed"
  | "skipped";

export type PersistenceExecutionStatus = "queued" | "running" | "completed" | "failed";

const workflowTransitionMap: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  planning: ["running"],
  running: ["retrying", "waiting_for_user", "completed", "failed", "cancelled"],
  retrying: ["running"],
  waiting_for_user: ["running"],
  completed: [],
  failed: [],
  cancelled: [],
};

const taskTransitionMap: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ["ready", "skipped"],
  ready: ["running", "skipped"],
  running: ["retrying", "waiting_for_user", "completed", "failed", "skipped"],
  retrying: ["ready", "running", "failed"],
  waiting_for_user: ["ready", "running", "failed", "skipped"],
  completed: [],
  failed: [],
  skipped: [],
};

export type StateTransitionErrorCode = "INVALID_WORKFLOW_TRANSITION" | "INVALID_TASK_TRANSITION";

export class StateTransitionError extends Error {
  readonly code: StateTransitionErrorCode;
  readonly entityType: "workflow" | "task";
  readonly from: string;
  readonly to: string;
  readonly entityId?: string;

  constructor(params: {
    code: StateTransitionErrorCode;
    entityType: "workflow" | "task";
    from: string;
    to: string;
    entityId?: string;
  }) {
    super(`${params.entityType} transition is not allowed: ${params.from} -> ${params.to}`);
    this.name = "StateTransitionError";
    this.code = params.code;
    this.entityType = params.entityType;
    this.from = params.from;
    this.to = params.to;
    this.entityId = params.entityId;
  }
}

export function canTransitionWorkflowStatus(from: WorkflowStatus, to: WorkflowStatus) {
  return workflowTransitionMap[from].includes(to);
}

export function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus) {
  return taskTransitionMap[from].includes(to);
}

export function assertWorkflowTransition(from: WorkflowStatus, to: WorkflowStatus, entityId?: string) {
  if (!canTransitionWorkflowStatus(from, to)) {
    throw new StateTransitionError({
      code: "INVALID_WORKFLOW_TRANSITION",
      entityType: "workflow",
      from,
      to,
      entityId,
    });
  }
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus, entityId?: string) {
  if (!canTransitionTaskStatus(from, to)) {
    throw new StateTransitionError({
      code: "INVALID_TASK_TRANSITION",
      entityType: "task",
      from,
      to,
      entityId,
    });
  }
}

export class WorkflowStateMachine {
  private _status: WorkflowStatus;
  private readonly entityId?: string;

  constructor(initial: WorkflowStatus = "planning", entityId?: string) {
    this._status = initial;
    this.entityId = entityId;
  }

  get status() {
    return this._status;
  }

  transitionTo(next: WorkflowStatus) {
    assertWorkflowTransition(this._status, next, this.entityId);
    this._status = next;
    return this._status;
  }
}

export class TaskStateMachine {
  private _status: TaskStatus;
  private readonly entityId?: string;

  constructor(initial: TaskStatus = "pending", entityId?: string) {
    this._status = initial;
    this.entityId = entityId;
  }

  get status() {
    return this._status;
  }

  transitionTo(next: TaskStatus) {
    assertTaskTransition(this._status, next, this.entityId);
    this._status = next;
    return this._status;
  }
}

export function mapWorkflowStatusToPersistence(status: WorkflowStatus): PersistenceExecutionStatus {
  if (status === "planning") return "queued";
  if (status === "running" || status === "retrying" || status === "waiting_for_user") return "running";
  if (status === "completed") return "completed";
  return "failed";
}

export function mapTaskStatusToPersistence(status: TaskStatus): PersistenceExecutionStatus {
  if (status === "pending" || status === "ready") return "queued";
  if (status === "running" || status === "retrying" || status === "waiting_for_user") return "running";
  if (status === "completed" || status === "skipped") return "completed";
  return "failed";
}

export const workflowTransitions = workflowTransitionMap;
export const taskTransitions = taskTransitionMap;
