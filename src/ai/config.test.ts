import { afterEach, describe, expect, it, vi } from "vitest";
import { AIProviderConfigurationError, assertAgentProviderConfigured } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertAgentProviderConfigured — AI provider fail-loud outside local/test", () => {
  it("(1) allows the silent mock fallback during test", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("AI_PROVIDER_DEFAULT", "");
    vi.stubEnv("AI_PROVIDER_business_strategist", "");

    expect(() => assertAgentProviderConfigured("business_strategist")).not.toThrow();
  });

  it("(1) allows the silent mock fallback for local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("AI_PROVIDER_DEFAULT", "");
    vi.stubEnv("AI_PROVIDER_business_strategist", "");

    expect(() => assertAgentProviderConfigured("business_strategist")).not.toThrow();
  });

  it("(2) rejects the silent mock fallback on Vercel Preview", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("AI_PROVIDER_DEFAULT", "");
    vi.stubEnv("AI_PROVIDER_business_strategist", "");

    expect(() => assertAgentProviderConfigured("business_strategist")).toThrow(AIProviderConfigurationError);
  });

  it("(3) rejects the silent mock fallback on Vercel Production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("AI_PROVIDER_DEFAULT", "");
    vi.stubEnv("AI_PROVIDER_business_strategist", "");

    expect(() => assertAgentProviderConfigured("business_strategist")).toThrow(AIProviderConfigurationError);
  });

  it("(3) rejects the silent mock fallback whenever NODE_ENV=production, even if VERCEL_ENV is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("AI_PROVIDER_DEFAULT", "");
    vi.stubEnv("AI_PROVIDER_business_strategist", "");

    expect(() => assertAgentProviderConfigured("business_strategist")).toThrow(AIProviderConfigurationError);
  });

  it("(4) resolves normally on Preview when AI_PROVIDER_DEFAULT is explicitly configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("AI_PROVIDER_DEFAULT", "openai");
    vi.stubEnv("AI_PROVIDER_business_strategist", "");

    expect(() => assertAgentProviderConfigured("business_strategist")).not.toThrow();
  });

  it("(4) resolves normally on Production when the per-agent override is explicitly configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("AI_PROVIDER_DEFAULT", "");
    vi.stubEnv("AI_PROVIDER_business_strategist", "openai");

    expect(() => assertAgentProviderConfigured("business_strategist")).not.toThrow();
  });

  it("(5) never includes any secret value in the thrown error message", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("AI_PROVIDER_DEFAULT", "");
    vi.stubEnv("AI_PROVIDER_business_strategist", "");
    const fakeSecret = "sk-super-secret-value-should-never-leak";
    vi.stubEnv("OPENAI_API_KEY", fakeSecret);

    let caught: unknown;
    try {
      assertAgentProviderConfigured("business_strategist");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AIProviderConfigurationError);
    const message = (caught as Error).message;
    expect(message).not.toContain(fakeSecret);
    expect(message).toContain("AI_PROVIDER_business_strategist");
    expect(message).toContain("AI_PROVIDER_DEFAULT");
  });

  it("identifies the missing configuration by variable name for a different agent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("AI_PROVIDER_DEFAULT", "");
    vi.stubEnv("AI_PROVIDER_market_research", "");

    expect(() => assertAgentProviderConfigured("market_research")).toThrow(/AI_PROVIDER_market_research/);
  });
});
