import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, signInWithPasswordMock, signUpMock, signOutMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signUpMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { signInAction, signOutAction, signUpAction, type AuthActionState } from "./actions";

const idleState: AuthActionState = { status: "idle", error: null };

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

describe("auth server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
        signOut: signOutMock,
      },
    });
  });

  describe("signInAction", () => {
    it("rejects invalid form data without calling Supabase", async () => {
      const result = await signInAction(
        "/create-project",
        idleState,
        formData({ email: "not-an-email", password: "" }),
      );

      expect(result.status).toBe("error");
      expect(signInWithPasswordMock).not.toHaveBeenCalled();
    });

    it("returns a generic error without leaking Supabase's internal error details", async () => {
      signInWithPasswordMock.mockResolvedValue({
        error: { message: "invalid_grant: refresh token revoked for user 8f2c" },
      });

      const result = await signInAction(
        "/create-project",
        idleState,
        formData({ email: "user@fikra.test", password: "hunter2" }),
      );

      expect(result.status).toBe("error");
      expect(result.error).toBe("Invalid email or password.");
      expect(result.error).not.toMatch(/invalid_grant/);
      expect(result.error).not.toMatch(/8f2c/);
    });

    it("redirects to a safe sanitized next path on success", async () => {
      signInWithPasswordMock.mockResolvedValue({ error: null });

      await expect(
        signInAction("/create-project", idleState, formData({ email: "user@fikra.test", password: "hunter2" })),
      ).rejects.toThrow("REDIRECT:/create-project");

      expect(redirectMock).toHaveBeenCalledWith("/create-project");
    });

    it("never redirects to an attacker-supplied absolute URL", async () => {
      signInWithPasswordMock.mockResolvedValue({ error: null });

      await expect(
        signInAction("https://evil.com/phish", idleState, formData({ email: "user@fikra.test", password: "hunter2" })),
      ).rejects.toThrow("REDIRECT:/");

      expect(redirectMock).toHaveBeenCalledWith("/");
    });
  });

  describe("signUpAction", () => {
    it("rejects a short password without calling Supabase", async () => {
      const result = await signUpAction(
        "/create-project",
        idleState,
        formData({ email: "user@fikra.test", password: "short", confirmPassword: "short" }),
      );

      expect(result.status).toBe("error");
      expect(signUpMock).not.toHaveBeenCalled();
    });

    it("rejects mismatched passwords without calling Supabase", async () => {
      const result = await signUpAction(
        "/create-project",
        idleState,
        formData({ email: "user@fikra.test", password: "longenoughpassword", confirmPassword: "different" }),
      );

      expect(result.status).toBe("error");
      expect(result.error).toBe("Passwords do not match.");
      expect(signUpMock).not.toHaveBeenCalled();
    });

    it("returns a generic error without leaking Supabase's internal error details", async () => {
      signUpMock.mockResolvedValue({
        data: { session: null },
        error: { message: "User already registered (user_id=abc123)" },
      });

      const result = await signUpAction(
        "/create-project",
        idleState,
        formData({ email: "user@fikra.test", password: "longenoughpassword", confirmPassword: "longenoughpassword" }),
      );

      expect(result.status).toBe("error");
      expect(result.error).toBe("Could not create your account. Please try again.");
      expect(result.error).not.toMatch(/abc123/);
    });

    it("shows a confirmation message instead of redirecting when email confirmation is required", async () => {
      signUpMock.mockResolvedValue({ data: { session: null }, error: null });

      const result = await signUpAction(
        "/create-project",
        idleState,
        formData({ email: "user@fikra.test", password: "longenoughpassword", confirmPassword: "longenoughpassword" }),
      );

      expect(result.status).toBe("success");
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("redirects to the sanitized next path when a session is issued immediately", async () => {
      signUpMock.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });

      await expect(
        signUpAction(
          "/create-project",
          idleState,
          formData({ email: "user@fikra.test", password: "longenoughpassword", confirmPassword: "longenoughpassword" }),
        ),
      ).rejects.toThrow("REDIRECT:/create-project");
    });
  });

  describe("signOutAction", () => {
    it("signs out through Supabase and redirects home", async () => {
      signOutMock.mockResolvedValue({ error: null });

      await expect(signOutAction(new FormData())).rejects.toThrow("REDIRECT:/");

      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(redirectMock).toHaveBeenCalledWith("/");
    });
  });
});
