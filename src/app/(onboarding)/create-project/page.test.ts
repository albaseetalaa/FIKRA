import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOptionalUserMock } = vi.hoisted(() => ({
  getOptionalUserMock: vi.fn(),
}));

vi.mock("@/lib/auth/getOptionalUser", () => ({
  getOptionalUser: getOptionalUserMock,
}));

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("./CreateProjectWizard", () => ({
  default: function CreateProjectWizardStub() {
    return null;
  },
}));

import CreateProjectPage from "./page";
import CreateProjectWizard from "./CreateProjectWizard";

describe("create-project page server guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1: redirects an unauthenticated visitor to login with a return URL to /create-project", async () => {
    getOptionalUserMock.mockResolvedValue(null);

    await expect(CreateProjectPage()).rejects.toThrow("REDIRECT:/login?next=%2Fcreate-project");
    expect(redirectMock).toHaveBeenCalledWith("/login?next=%2Fcreate-project");
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it("2: renders the wizard for an authenticated visitor without redirecting", async () => {
    getOptionalUserMock.mockResolvedValue({ id: "user_test_1", email: "owner@fikra.test" });

    const element = await CreateProjectPage();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(element.type).toBe(CreateProjectWizard);
    expect(element.props).toEqual({ userId: "user_test_1" });
  });

  it("does not pass any organization/tenant identifier down beyond the authenticated user id", async () => {
    getOptionalUserMock.mockResolvedValue({ id: "user_test_1" });

    const element = await CreateProjectPage();

    expect(Object.keys(element.props as object)).toEqual(["userId"]);
  });
});
