import { describe, it, expect } from "vitest";
import Orchestrator from "../orchestrator";
import pipelines from "../pipelines/pipelines";
import agents from "../agents/definitions";
import mocks from "./mocks";

describe("Orchestrator validation flow", () => {
  it("stores valid agent outputs and marks task completed", async () => {
    const orch = new Orchestrator(pipelines, agents);
    // register a valid business plan for the business_strategist
    orch.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    const tasks = await orch.startPipeline("project_creation", "proj-1");
    const task = tasks.find((t) => t.step.agent === "business_strategist");
    expect(task).toBeDefined();
    expect(task?.status).toBe("completed");
  });

  it("rejects invalid outputs and marks task failed", async () => {
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.invalidBusinessPlan);
    const tasks = await orch.startPipeline("project_creation", "proj-2");
    const task = tasks.find((t) => t.step.agent === "business_strategist");
    expect(task).toBeDefined();
    expect(task?.status).toBe("failed");
    expect(task!.attempts.length).toBeGreaterThan(0);
    const attempt = task!.attempts[0]!;
    expect(attempt).toBeDefined();
    expect(attempt.error).toBeDefined();
  });

  it("handles malformed JSON as retryable then fails if retries exhausted", async () => {
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.malformedResponse);
    // also add a valid one to see retry behavior; but since malformed is retryable, if no more responses, it should fail
    const tasks = await orch.startPipeline("project_creation", "proj-3");
    const task = tasks.find((t) => t.step.agent === "business_strategist");
    expect(task).toBeDefined();
    expect(task?.status).toBe("failed");
    expect(task!.attempts.length).toBeGreaterThanOrEqual(1);
    const attempt2 = task!.attempts[0]!;
    expect(attempt2).toBeDefined();
    expect(attempt2.error).toBeDefined();
  });
});
