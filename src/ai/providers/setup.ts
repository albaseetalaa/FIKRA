import { globalProviderManager } from "./manager";
import MockProvider from "./mockProvider";
import OpenAIProvider from "./openaiProvider";
import StructuredStubProvider from "./structuredStub";
import type AIProvider from "./interface";

export function registerDefaultProviders() {
  globalProviderManager.clear();

  // Always register mock provider
  globalProviderManager.register(MockProvider);

  // Register structured stub provider
  globalProviderManager.register(StructuredStubProvider);

  // If OpenAI API key present, register OpenAI provider
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAIProvider();
      globalProviderManager.register(openai as AIProvider);
    } catch {
      // ignore errors during provider initialization
    }
  }
}

registerDefaultProviders();

export default globalProviderManager;
