import { describe, it, expect, afterAll } from "vitest";
import { globalProviderManager } from "../providers/manager";
import MockProvider from "../providers/mockProvider";
import StructuredStubProvider from "../providers/structuredStub";
import { globalArtifactStore } from "../store/setup";
import "../providers/setup";
import { registerDefaultProviders } from "../providers/setup";

describe("Provider setup and artifact store", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  afterAll(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  });

  it("registers MockProvider", () => {
    expect(globalProviderManager.has("mock")).toBe(true);
    const provider = globalProviderManager.get("mock");
    expect(provider).toBe(MockProvider);
  });

  it("registers StructuredStubProvider", () => {
    expect(globalProviderManager.has("structured-stub")).toBe(true);
    const provider = globalProviderManager.get("structured-stub");
    expect(provider).toBe(StructuredStubProvider);
  });

  it("does not register OpenAIProvider when OPENAI_API_KEY is missing", () => {
    process.env.OPENAI_API_KEY = "";
    registerDefaultProviders();
    const hasOpenAI = globalProviderManager.has("openai");
    expect(hasOpenAI).toBe(false);
  });

  it("globalArtifactStore is singleton", () => {
    const second = globalArtifactStore;
    expect(second).toBe(globalArtifactStore);
    expect(typeof globalArtifactStore.save).toBe("function");
    expect(typeof globalArtifactStore.list).toBe("function");
  });
});
