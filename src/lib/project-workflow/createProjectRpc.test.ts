import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, createClientMock } = vi.hoisted(() => {
  const rpc = vi.fn();
  return {
    rpcMock: rpc,
    createClientMock: vi.fn(async () => ({ rpc })),
  };
});

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import {
  executeCreateProjectRpc,
  ProjectCreationPersistenceError,
  ProjectCreationValidationError,
} from "./createProjectRpc";

const exactArgs = {
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
};

describe("executeCreateProjectRpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1: uses the request-scoped createClient()", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ project_id: "proj_1", organization_id: "org_1", workflow_run_id: "run_1" }],
      error: null,
    });

    await executeCreateProjectRpc(exactArgs);

    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it("2: never calls createAdminClient()", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ project_id: "proj_1", organization_id: "org_1", workflow_run_id: "run_1" }],
      error: null,
    });

    await executeCreateProjectRpc(exactArgs);

    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("3: calls client.rpc('create_project', exactArgs) exactly once", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ project_id: "proj_1", organization_id: "org_1", workflow_run_id: "run_1" }],
      error: null,
    });

    await executeCreateProjectRpc(exactArgs);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("create_project", exactArgs);
  });

  it("4: maps a single returned row to { projectId, organizationId, workflowRunId }", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ project_id: "proj_abc123", organization_id: "org_abc123", workflow_run_id: "run_abc123" }],
      error: null,
    });

    const result = await executeCreateProjectRpc(exactArgs);

    expect(result).toEqual({
      projectId: "proj_abc123",
      organizationId: "org_abc123",
      workflowRunId: "run_abc123",
    });
  });

  it("5: a Supabase error with code 22023 becomes ProjectCreationValidationError", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "idea must be at least 10 characters.", code: "22023" },
    });

    await expect(executeCreateProjectRpc(exactArgs)).rejects.toBeInstanceOf(ProjectCreationValidationError);
  });

  it("6: any other Supabase error becomes ProjectCreationPersistenceError", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "connection reset", code: "08006" },
    });

    await expect(executeCreateProjectRpc(exactArgs)).rejects.toBeInstanceOf(ProjectCreationPersistenceError);
  });

  it("7a: null data becomes ProjectCreationPersistenceError", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(executeCreateProjectRpc(exactArgs)).rejects.toBeInstanceOf(ProjectCreationPersistenceError);
  });

  it("7b: an empty array becomes ProjectCreationPersistenceError", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });

    await expect(executeCreateProjectRpc(exactArgs)).rejects.toBeInstanceOf(ProjectCreationPersistenceError);
  });

  it("7c: malformed row fields become ProjectCreationPersistenceError", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ project_id: 12345, organization_id: null, workflow_run_id: "run_1" }],
      error: null,
    });

    await expect(executeCreateProjectRpc(exactArgs)).rejects.toBeInstanceOf(ProjectCreationPersistenceError);
  });

  it("7d: multiple returned rows become ProjectCreationPersistenceError", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        { project_id: "proj_1", organization_id: "org_1", workflow_run_id: "run_1" },
        { project_id: "proj_2", organization_id: "org_2", workflow_run_id: "run_2" },
      ],
      error: null,
    });

    await expect(executeCreateProjectRpc(exactArgs)).rejects.toBeInstanceOf(ProjectCreationPersistenceError);
  });
});
