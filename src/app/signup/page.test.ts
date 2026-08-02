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

vi.mock("./SignupForm", () => ({
  default: function SignupFormStub() {
    return null;
  },
}));

import SignupPage from "./page";
import SignupForm from "./SignupForm";

describe("signup page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the signup form with a sanitized next path for a visitor", async () => {
    getOptionalUserMock.mockResolvedValue(null);

    const element = await SignupPage({ searchParams: Promise.resolve({ next: "/create-project" }) });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(element.type).toBe(SignupForm);
    expect(element.props).toEqual({ nextPath: "/create-project" });
  });

  it("redirects an already-authenticated visitor straight to the next path", async () => {
    getOptionalUserMock.mockResolvedValue({ id: "user_test_1" });

    await expect(
      SignupPage({ searchParams: Promise.resolve({ next: "/create-project" }) }),
    ).rejects.toThrow("REDIRECT:/create-project");
  });
});
