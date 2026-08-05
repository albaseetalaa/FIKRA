import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requestContainerMock,
  getRequestPersistenceContainerMock,
  getSystemPersistenceContainerMock,
  getPersistenceContainerMock,
} = vi.hoisted(() => {
  const requestContainerMock = {
    projects: {
      getById: vi.fn(),
      list: vi.fn(),
    },
    workflowResume: {
      findProjectForWorkflowRun: vi.fn(),
    },
  };

  return {
    requestContainerMock,
    getRequestPersistenceContainerMock: vi.fn(() => requestContainerMock),
    getSystemPersistenceContainerMock: vi.fn(),
    getPersistenceContainerMock: vi.fn(),
  };
});

vi.mock("../persistence/setup", () => ({
  getRequestPersistenceContainer: getRequestPersistenceContainerMock,
  getSystemPersistenceContainer: getSystemPersistenceContainerMock,
  getPersistenceContainer: getPersistenceContainerMock,
}));

import { authorizeWorkflowResume } from "./service";

beforeEach(() => {
  vi.clearAllMocks();
  getRequestPersistenceContainerMock.mockReturnValue(requestContainerMock);
});

describe("authorizeWorkflowResume", () => {
  it("1: calls getRequestPersistenceContainer({ userId }) exactly once", async () => {
    requestContainerMock.workflowResume.findProjectForWorkflowRun.mockResolvedValueOnce(null);

    await authorizeWorkflowResume({ userId: "user-resume-a" }, "run-resume-a");

    expect(getRequestPersistenceContainerMock).toHaveBeenCalledTimes(1);
    expect(getRequestPersistenceContainerMock).toHaveBeenCalledWith({ userId: "user-resume-a" });
  });

  it("2: calls request.workflowResume.findProjectForWorkflowRun(workflowRunId) exactly once", async () => {
    requestContainerMock.workflowResume.findProjectForWorkflowRun.mockResolvedValueOnce(null);

    await authorizeWorkflowResume({ userId: "user-resume-a" }, "run-resume-a");

    expect(requestContainerMock.workflowResume.findProjectForWorkflowRun).toHaveBeenCalledTimes(1);
    expect(requestContainerMock.workflowResume.findProjectForWorkflowRun).toHaveBeenCalledWith("run-resume-a");
  });

  it("3: maps a resolved target to the exact handoff shape", async () => {
    requestContainerMock.workflowResume.findProjectForWorkflowRun.mockResolvedValueOnce({
      workflowRunId: "run-resume-a",
      projectId: "proj-resume-a",
      organizationId: "org-resume-a",
    });

    const handoff = await authorizeWorkflowResume({ userId: "user-resume-a" }, "run-resume-a");

    expect(handoff).toEqual({
      workflowRunId: "run-resume-a",
      projectId: "proj-resume-a",
      organizationId: "org-resume-a",
    });
  });

  it("4: the returned handoff contains exactly workflowRunId, projectId, organizationId", async () => {
    requestContainerMock.workflowResume.findProjectForWorkflowRun.mockResolvedValueOnce({
      workflowRunId: "run-resume-a",
      projectId: "proj-resume-a",
      organizationId: "org-resume-a",
    });

    const handoff = await authorizeWorkflowResume({ userId: "user-resume-a" }, "run-resume-a");

    expect(handoff && Object.keys(handoff).sort()).toEqual(["organizationId", "projectId", "workflowRunId"]);
    expect(handoff && "userId" in handoff).toBe(false);
    expect(handoff && "createdBy" in handoff).toBe(false);
    expect(handoff && "project" in handoff).toBe(false);
    expect(handoff && "workflowRun" in handoff).toBe(false);
    expect(handoff && "metadata" in handoff).toBe(false);
    expect(handoff && "checkpoint" in handoff).toBe(false);
    expect(handoff && "requestId" in handoff).toBe(false);
    expect(handoff && "values" in handoff).toBe(false);
  });

  it("5: returns a fresh object, not the same reference returned by the repository", async () => {
    const repositoryResult = {
      workflowRunId: "run-resume-a",
      projectId: "proj-resume-a",
      organizationId: "org-resume-a",
    };
    requestContainerMock.workflowResume.findProjectForWorkflowRun.mockResolvedValueOnce(repositoryResult);

    const handoff = await authorizeWorkflowResume({ userId: "user-resume-a" }, "run-resume-a");

    expect(handoff).not.toBe(repositoryResult);
    expect(handoff).toEqual(repositoryResult);
  });

  it("6: returns exactly null when the repository returns null", async () => {
    requestContainerMock.workflowResume.findProjectForWorkflowRun.mockResolvedValueOnce(null);

    const handoff = await authorizeWorkflowResume({ userId: "user-resume-a" }, "run-resume-a");

    expect(handoff).toBeNull();
  });

  it("7: never calls the system/unscoped persistence paths", async () => {
    requestContainerMock.workflowResume.findProjectForWorkflowRun.mockResolvedValueOnce(null);

    await authorizeWorkflowResume({ userId: "user-resume-a" }, "run-resume-a");

    expect(getSystemPersistenceContainerMock).not.toHaveBeenCalled();
    expect(getPersistenceContainerMock).not.toHaveBeenCalled();
    expect(requestContainerMock.projects.getById).not.toHaveBeenCalled();
    expect(requestContainerMock.projects.list).not.toHaveBeenCalled();
  });

  it("8: passes the supplied workflowRunId unchanged, no trimming/normalization", async () => {
    requestContainerMock.workflowResume.findProjectForWorkflowRun.mockResolvedValueOnce(null);

    await authorizeWorkflowResume({ userId: "user-resume-a" }, "  Run-Resume-A  ");

    expect(requestContainerMock.workflowResume.findProjectForWorkflowRun).toHaveBeenCalledWith("  Run-Resume-A  ");
  });

  it("9: repository errors propagate unchanged", async () => {
    const infrastructureError = new Error("connection reset");
    requestContainerMock.workflowResume.findProjectForWorkflowRun.mockRejectedValueOnce(infrastructureError);

    await expect(authorizeWorkflowResume({ userId: "user-resume-a" }, "run-resume-a")).rejects.toBe(infrastructureError);
  });

  it("10: two calls with different contexts remain independently scoped", async () => {
    requestContainerMock.workflowResume.findProjectForWorkflowRun.mockResolvedValue(null);

    await authorizeWorkflowResume({ userId: "user-resume-a" }, "run-resume-a");
    await authorizeWorkflowResume({ userId: "user-resume-b" }, "run-resume-b");

    expect(getRequestPersistenceContainerMock).toHaveBeenNthCalledWith(1, { userId: "user-resume-a" });
    expect(getRequestPersistenceContainerMock).toHaveBeenNthCalledWith(2, { userId: "user-resume-b" });
  });
});
