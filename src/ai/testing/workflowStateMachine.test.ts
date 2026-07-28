import { describe, expect, it } from "vitest";
import {
  StateTransitionError,
  TaskStateMachine,
  WorkflowStateMachine,
  assertTaskTransition,
  assertWorkflowTransition,
  canTransitionTaskStatus,
  canTransitionWorkflowStatus,
  mapTaskStatusToPersistence,
  mapWorkflowStatusToPersistence,
  taskTransitions,
  workflowTransitions,
  type TaskStatus,
  type WorkflowStatus,
} from "../workflow/stateMachine";

const workflowStatuses: WorkflowStatus[] = [
  "planning",
  "running",
  "retrying",
  "waiting_for_user",
  "completed",
  "failed",
  "cancelled",
];

const taskStatuses: TaskStatus[] = [
  "pending",
  "ready",
  "running",
  "retrying",
  "waiting_for_user",
  "completed",
  "failed",
  "skipped",
];

describe("workflow state machine transitions", () => {
  it("allows every declared valid workflow transition", () => {
    for (const from of workflowStatuses) {
      for (const to of workflowTransitions[from]) {
        expect(canTransitionWorkflowStatus(from, to)).toBe(true);
        expect(() => assertWorkflowTransition(from, to)).not.toThrow();
      }
    }
  });

  it("rejects every invalid workflow transition", () => {
    for (const from of workflowStatuses) {
      for (const to of workflowStatuses) {
        const isAllowed = workflowTransitions[from].includes(to);
        if (isAllowed) continue;

        expect(canTransitionWorkflowStatus(from, to)).toBe(false);
        expect(() => assertWorkflowTransition(from, to, "wf-1")).toThrow(StateTransitionError);
      }
    }
  });

  it("throws typed workflow domain errors", () => {
    try {
      assertWorkflowTransition("completed", "running", "wf-typed");
      throw new Error("expected transition error");
    } catch (error) {
      expect(error).toBeInstanceOf(StateTransitionError);
      const typed = error as StateTransitionError;
      expect(typed.code).toBe("INVALID_WORKFLOW_TRANSITION");
      expect(typed.entityType).toBe("workflow");
      expect(typed.from).toBe("completed");
      expect(typed.to).toBe("running");
      expect(typed.entityId).toBe("wf-typed");
    }
  });

  it("supports workflow lifecycle transitions", () => {
    const machine = new WorkflowStateMachine("planning", "wf-lifecycle");
    expect(machine.status).toBe("planning");

    machine.transitionTo("running");
    expect(machine.status).toBe("running");

    machine.transitionTo("retrying");
    expect(machine.status).toBe("retrying");

    machine.transitionTo("running");
    expect(machine.status).toBe("running");

    machine.transitionTo("waiting_for_user");
    expect(machine.status).toBe("waiting_for_user");

    machine.transitionTo("running");
    machine.transitionTo("completed");
    expect(machine.status).toBe("completed");
  });
});

describe("task state machine transitions", () => {
  it("allows every declared valid task transition", () => {
    for (const from of taskStatuses) {
      for (const to of taskTransitions[from]) {
        expect(canTransitionTaskStatus(from, to)).toBe(true);
        expect(() => assertTaskTransition(from, to)).not.toThrow();
      }
    }
  });

  it("rejects every invalid task transition", () => {
    for (const from of taskStatuses) {
      for (const to of taskStatuses) {
        const isAllowed = taskTransitions[from].includes(to);
        if (isAllowed) continue;

        expect(canTransitionTaskStatus(from, to)).toBe(false);
        expect(() => assertTaskTransition(from, to, "task-1")).toThrow(StateTransitionError);
      }
    }
  });

  it("throws typed task domain errors", () => {
    try {
      assertTaskTransition("failed", "retrying", "task-typed");
      throw new Error("expected transition error");
    } catch (error) {
      expect(error).toBeInstanceOf(StateTransitionError);
      const typed = error as StateTransitionError;
      expect(typed.code).toBe("INVALID_TASK_TRANSITION");
      expect(typed.entityType).toBe("task");
      expect(typed.from).toBe("failed");
      expect(typed.to).toBe("retrying");
      expect(typed.entityId).toBe("task-typed");
    }
  });

  it("supports task lifecycle transitions", () => {
    const machine = new TaskStateMachine("pending", "task-lifecycle");
    expect(machine.status).toBe("pending");

    machine.transitionTo("ready");
    machine.transitionTo("running");
    machine.transitionTo("retrying");
    machine.transitionTo("running");
    machine.transitionTo("completed");
    expect(machine.status).toBe("completed");
  });
});

describe("persistence status mapping", () => {
  it("maps workflow statuses without schema changes", () => {
    expect(mapWorkflowStatusToPersistence("planning")).toBe("queued");
    expect(mapWorkflowStatusToPersistence("running")).toBe("running");
    expect(mapWorkflowStatusToPersistence("retrying")).toBe("running");
    expect(mapWorkflowStatusToPersistence("waiting_for_user")).toBe("running");
    expect(mapWorkflowStatusToPersistence("completed")).toBe("completed");
    expect(mapWorkflowStatusToPersistence("failed")).toBe("failed");
    expect(mapWorkflowStatusToPersistence("cancelled")).toBe("failed");
  });

  it("maps task statuses without schema changes", () => {
    expect(mapTaskStatusToPersistence("pending")).toBe("queued");
    expect(mapTaskStatusToPersistence("ready")).toBe("queued");
    expect(mapTaskStatusToPersistence("running")).toBe("running");
    expect(mapTaskStatusToPersistence("retrying")).toBe("running");
    expect(mapTaskStatusToPersistence("waiting_for_user")).toBe("running");
    expect(mapTaskStatusToPersistence("completed")).toBe("completed");
    expect(mapTaskStatusToPersistence("failed")).toBe("failed");
    expect(mapTaskStatusToPersistence("skipped")).toBe("completed");
  });
});
