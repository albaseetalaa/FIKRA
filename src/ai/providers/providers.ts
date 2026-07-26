/**
 * Placeholder provider adapters and interfaces for future AI integrations.
 * Implement concrete adapters under src/ai/providers for OpenAI, Anthropic, Gemini, etc.
 */

export interface AIProviderConfig {
  id: string;
  name: string;
  apiKey?: string;
}

export interface AIProvider {
  config: AIProviderConfig;
  // Sends a prompt and returns a provider-specific response payload.
  invoke(prompt: string, options?: Record<string, unknown>): Promise<unknown>;
}
export interface AIProvider {
  config: AIProviderConfig;
  // Sends a prompt and returns a provider-specific response payload.
  invoke(prompt: string, options?: Record<string, unknown>): Promise<unknown>;
}

export const noopProvider: AIProvider = {
  config: { id: "noop", name: "NoOp" },
  invoke: async () => ({ text: "noop" }),
};

export default noopProvider;
