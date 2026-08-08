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

vi.mock("./LoginForm", () => ({
  default: function LoginFormStub() {
    return null;
  },
}));

import LoginPage from "./page";
import LoginForm from "./LoginForm";

describe("login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form with a sanitized next path for a visitor", async () => {
    getOptionalUserMock.mockResolvedValue(null);

    const element = await LoginPage({ searchParams: Promise.resolve({ next: "/create-project" }) });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(element.type).toBe(LoginForm);
    expect(element.props).toEqual({ nextPath: "/create-project" });
  });

  it("falls back to '/' for an unsafe next path", async () => {
    getOptionalUserMock.mockResolvedValue(null);

    const element = await LoginPage({ searchParams: Promise.resolve({ next: "https://evil.com" }) });

    expect(element.props).toEqual({ nextPath: "/" });
  });

  it("redirects an already-authenticated visitor straight to the next path", async () => {
    getOptionalUserMock.mockResolvedValue({ id: "user_test_1" });

    await expect(
      LoginPage({ searchParams: Promise.resolve({ next: "/create-project" }) }),
    ).rejects.toThrow("REDIRECT:/create-project");
  });
});
