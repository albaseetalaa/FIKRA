import type AIProvider from "./interface";

export const MockProvider: AIProvider = {
  id: "mock",
  name: "Mock Provider",
  invoke: async (prompt: string) => {
    // simple echo-style mock; in production tests, orchestrator.registerMockResponse is preferred
    return { text: `MOCK_RESPONSE: ${String(prompt).slice(0, 200)}` };
  },
  stream: undefined,
  health: async () => ({ ok: true }),
  models: async () => ["mock-small"],
  validateConfiguration: async () => true,
};

export default MockProvider;
