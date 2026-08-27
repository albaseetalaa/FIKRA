import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPersistenceContainer,
  PersistenceConfigurationError,
  resetPersistenceContainerForTests,
} from "./setup";

afterEach(() => {
  resetPersistenceContainerForTests();
  vi.unstubAllEnvs();
});

describe("persistence provider safety", () => {
  it("uses memory persistence during tests", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AI_PERSISTENCE_PROVIDER", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(getPersistenceContainer().provider).toBe("memory");
  });

  it("allows memory persistence for local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PERSISTENCE_PROVIDER", "memory");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(getPersistenceContainer().provider).toBe("memory");
  });

  it("rejects memory persistence in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PERSISTENCE_PROVIDER", "memory");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => getPersistenceContainer()).toThrow(
      /production.*supabase/i,
    );
  });

  it("rejects Supabase persistence when server credentials are missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PERSISTENCE_PROVIDER", "supabase");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => getPersistenceContainer()).toThrow(
      /SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY/i,
    );
  });

  it("creates Supabase persistence when production is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PERSISTENCE_PROVIDER", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

    expect(getPersistenceContainer().provider).toBe("supabase");
  });

  it("throws PersistenceConfigurationError (not a generic Error) when production is missing AI_PERSISTENCE_PROVIDER", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PERSISTENCE_PROVIDER", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => getPersistenceContainer()).toThrow(PersistenceConfigurationError);
  });

  it("throws PersistenceConfigurationError (not a generic Error) when Supabase credentials are missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PERSISTENCE_PROVIDER", "supabase");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => getPersistenceContainer()).toThrow(PersistenceConfigurationError);
  });
});
