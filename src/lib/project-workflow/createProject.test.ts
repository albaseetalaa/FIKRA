import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSystemPersistenceContainer, resetPersistenceContainerForTests } from "../persistence/setup";
import { createProject, type CreateProjectInput } from "./service";

function forceMemoryProvider() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AI_PERSISTENCE_PROVIDER", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
}

beforeEach(() => {
  forceMemoryProvider();
  resetPersistenceContainerForTests();
});

afterEach(() => {
  resetPersistenceContainerForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function makeInput(overrides: Partial<CreateProjectInput> = {}): CreateProjectInput {
  return {
    idea: "Build a subscription box for artisanal coffee beans.",
    ...overrides,
  };
}

function makeExecutor(result = { projectId: "proj_abc", organizationId: "org_abc", workflowRunId: "run_abc" }) {
  return { execute: vi.fn(async (_args: unknown) => result) };
}

describe("createProject", () => {
  it("1: calls executor.execute exactly once", async () => {
    const executor = makeExecutor();

    await createProject(makeInput(), executor);

    expect(executor.execute).toHaveBeenCalledTimes(1);
  });

  it("2: maps CreateProjectInput exactly to the RPC argument shape", async () => {
    const executor = makeExecutor();

    await createProject(
      makeInput({
        businessName: "Acme Coffee",
        industry: "Food & Beverage",
        country: "Jordan",
        city: "Amman",
        stage: "idea",
        audience: "Coffee enthusiasts",
        ageRange: "25-45",
        customerType: "Individuals",
        goals: ["Launch MVP", "Validate demand"],
        budget: "10000-20000",
        timeline: "6 months",
        currency: "JOD",
      }),
      executor,
    );

    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(executor.execute).toHaveBeenCalledWith({
      p_idea: "Build a subscription box for artisanal coffee beans.",
      p_business_name: "Acme Coffee",
      p_industry: "Food & Beverage",
      p_country: "Jordan",
      p_city: "Amman",
      p_stage: "idea",
      p_audience: "Coffee enthusiasts",
      p_age_range: "25-45",
      p_customer_type: "Individuals",
      p_goals: ["Launch MVP", "Validate demand"],
      p_budget: "10000-20000",
      p_timeline: "6 months",
      p_currency: "JOD",
    });
  });

  it("3: RPC arguments never contain system-controlled or identity fields", async () => {
    const executor = makeExecutor();

    await createProject(makeInput(), executor);

    expect(executor.execute).toHaveBeenCalledTimes(1);
    const callArgs = executor.execute.mock.calls[0]?.[0] as Record<string, unknown>;

    const forbiddenKeys = [
      "userId",
      "user_id",
      "createdBy",
      "created_by",
      "organizationId",
      "organization_id",
      "projectId",
      "project_id",
      "workflowRunId",
      "workflow_run_id",
      "status",
      "pipeline",
      "activePipelineId",
      "active_pipeline_id",
      "createdAt",
      "created_at",
      "updatedAt",
      "updated_at",
      "completedAt",
      "completed_at",
      "errorCode",
      "error_code",
      "sanitizedErrorMessage",
      "sanitized_error_message",
    ];

    for (const key of forbiddenKeys) {
      expect(Object.prototype.hasOwnProperty.call(callArgs, key)).toBe(false);
    }
  });

  it("4: maps the executor result to the existing service result shape", async () => {
    const executor = makeExecutor({ projectId: "proj_xyz", organizationId: "org_xyz", workflowRunId: "run_xyz" });

    const result = await createProject(makeInput(), executor);

    expect(result).toEqual({ projectId: "proj_xyz", status: "queued", workflowRunId: "run_xyz" });
    expect("organizationId" in result).toBe(false);
  });

  it("5: never writes through the system projects repository", async () => {
    const system = getSystemPersistenceContainer();
    const projectsCreateSpy = vi.spyOn(system.projects, "create");
    const executor = makeExecutor();

    await createProject(makeInput(), executor);

    expect(projectsCreateSpy).not.toHaveBeenCalled();
  });

  it("5b: never writes through the system workflowRuns repository", async () => {
    const system = getSystemPersistenceContainer();
    const workflowRunsCreateSpy = vi.spyOn(system.workflowRuns, "create");
    const executor = makeExecutor();

    await createProject(makeInput(), executor);

    expect(workflowRunsCreateSpy).not.toHaveBeenCalled();
  });

  it("6: when executor.execute rejects, the error propagates and no fallback write occurs", async () => {
    const system = getSystemPersistenceContainer();
    const projectsCreateSpy = vi.spyOn(system.projects, "create");
    const workflowRunsCreateSpy = vi.spyOn(system.workflowRuns, "create");
    const executor = {
      execute: vi.fn(async () => {
        throw new Error("rpc failed");
      }),
    };

    await expect(createProject(makeInput(), executor)).rejects.toThrow("rpc failed");

    expect(projectsCreateSpy).not.toHaveBeenCalled();
    expect(workflowRunsCreateSpy).not.toHaveBeenCalled();
  });

  it("7: preserves optional/null input mapping exactly without inventing or truncating values", async () => {
    const executor = makeExecutor();

    await createProject(makeInput(), executor);

    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(executor.execute).toHaveBeenCalledWith({
      p_idea: "Build a subscription box for artisanal coffee beans.",
      p_business_name: null,
      p_industry: null,
      p_country: null,
      p_city: null,
      p_stage: null,
      p_audience: null,
      p_age_range: null,
      p_customer_type: null,
      p_goals: null,
      p_budget: null,
      p_timeline: null,
      p_currency: null,
    });
  });
});
