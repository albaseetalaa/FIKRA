import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({ isSupabaseConfigured: true }));

vi.mock("@/lib/env", () => ({
  get isSupabaseConfigured() {
    return envMock.isSupabaseConfigured;
  },
}));

const { createClientMock, getUserMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { getOptionalUser } from "./getOptionalUser";

describe("getOptionalUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.isSupabaseConfigured = true;
    createClientMock.mockResolvedValue({
      auth: { getUser: getUserMock },
    });
  });

  it("returns the user when a session exists", async () => {
    const user = { id: "user_test_1", email: "owner@fikra.test" };
    getUserMock.mockResolvedValue({ data: { user }, error: null });

    await expect(getOptionalUser()).resolves.toEqual(user);
  });

  it("returns null when there is no session, without throwing", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getOptionalUser()).resolves.toBeNull();
  });

  it("returns null when Supabase reports an invalid session", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT" },
    });

    await expect(getOptionalUser()).resolves.toBeNull();
  });

  it("returns null without calling Supabase when it isn't configured", async () => {
    envMock.isSupabaseConfigured = false;

    await expect(getOptionalUser()).resolves.toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
