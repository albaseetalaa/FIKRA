import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("lazy artifact store setup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not initialize production persistence during module import", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PERSISTENCE_PROVIDER", "memory");

    await expect(import("./setup")).resolves.toMatchObject({
      globalArtifactStore: expect.any(Object),
    });
  });

  it("enforces production persistence when the store is actually used", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PERSISTENCE_PROVIDER", "memory");

    const { globalArtifactStore } = await import("./setup");

    expect(() => globalArtifactStore.list("build-check")).toThrow(
      /production.*supabase/i,
    );
  });
});
