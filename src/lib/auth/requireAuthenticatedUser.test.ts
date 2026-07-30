import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, getUserMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "./requireAuthenticatedUser";

describe("requireAuthenticatedUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    });
  });

  it("returns the verified Supabase user", async () => {
    const user = {
      id: "user_test_1",
      email: "owner@fikra.test",
    } as User;

    getUserMock.mockResolvedValue({
      data: { user },
      error: null,
    });

    await expect(requireAuthenticatedUser()).resolves.toBe(user);

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });

  it("rejects when no authenticated user exists", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });

  it("rejects an invalid or unverifiable session", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: {
        message: "Invalid JWT",
      },
    });

    await expect(requireAuthenticatedUser()).rejects.toMatchObject({
      name: "AuthenticationRequiredError",
      message: "Authentication required.",
    });
  });
});
