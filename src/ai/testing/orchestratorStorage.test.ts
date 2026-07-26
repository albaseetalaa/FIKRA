import { describe, it, expect, beforeEach } from "vitest";
import Orchestrator from "../orchestrator";
import pipelines from "../pipelines/pipelines";
import agents from "../agents/definitions";
import mocks from "./mocks";
import { globalArtifactStore } from "../store/setup";
import { InMemoryArtifactStore } from "../store/inMemoryStore";

describe("Orchestrator storage and provider flow", () => {
  beforeEach(() => {
    (globalArtifactStore as InMemoryArtifactStore).clear();
  });

  it("stores valid orchestrator output", async () => {
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    const tasks = await orch.startPipeline("project_creation", "proj-store-1");
    const task = tasks.find((t) => t.step.agent === "business_strategist");

    expect(task).toBeDefined();
    expect(task?.status).toBe("completed");
    const saved = await globalArtifactStore.list("proj-store-1");
    expect(saved.length).toBeGreaterThan(0);
    expect(saved[0]).toBeDefined();
    expect(saved[0]?.validationStatus).toBe("valid");
    expect(saved[0]?.projectId).toBe("proj-store-1");
  });

  it("does not store invalid orchestrator output", async () => {
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.invalidBusinessPlan);
    const tasks = await orch.startPipeline("project_creation", "proj-store-2");
    const task = tasks.find((t) => t.step.agent === "business_strategist");

    expect(task).toBeDefined();
    expect(task?.status).toBe("failed");
    const saved = await globalArtifactStore.list("proj-store-2");
    expect(saved.length).toBe(0);
  });

  it("executes full provider → normalize → validate → store flow", async () => {
    const orch = new Orchestrator(pipelines, agents);
    orch.registerMockResponse("business_strategist", mocks.validBusinessPlan);
    const tasks = await orch.startPipeline("project_creation", "proj-flow-1");
    expect(tasks.some((task) => task.status === "completed")).toBe(true);
    const saved = await globalArtifactStore.list("proj-flow-1");
    expect(saved.length).toBeGreaterThan(0);
    expect(saved[0]?.content).toEqual(mocks.validBusinessPlan);
  });
});
