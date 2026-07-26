export const DEFAULT_AI_PROVIDER = process.env.AI_PROVIDER_DEFAULT ?? "mock";

export function getAgentProvider(agentId: string) {
  return process.env[`AI_PROVIDER_${agentId}`] ?? DEFAULT_AI_PROVIDER;
}

export function getAgentModel(agentId: string) {
  const modelEnvKey = `OPENAI_MODEL_${agentId.toUpperCase()}`;
  return process.env[modelEnvKey] ?? process.env.OPENAI_MODEL_DEFAULT ?? "gpt-4o-mini";
}

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const RUN_OPENAI_INTEGRATION_TESTS = process.env.RUN_OPENAI_INTEGRATION_TESTS === "true";
export const AI_DEV_ENDPOINT_SECRET = process.env.AI_DEV_ENDPOINT_SECRET;
