export const DEFAULT_AI_PROVIDER = process.env.AI_PROVIDER_DEFAULT ?? "mock";

export function getAgentProvider(agentId: string) {
  return process.env[`AI_PROVIDER_${agentId}`] ?? DEFAULT_AI_PROVIDER;
}

export class AIProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIProviderConfigurationError";
  }
}

/**
 * Next.js sets NODE_ENV=production for both Vercel Preview and Production
 * builds — VERCEL_ENV ("preview" | "production", unset locally) is what
 * actually distinguishes them. Checking both keeps this correct even if a
 * future build config ever decouples NODE_ENV from "deployed".
 */
function isDeployedEnvironment(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const vercelEnv = process.env.VERCEL_ENV;
  return nodeEnv === "production" || vercelEnv === "production" || vercelEnv === "preview";
}

/**
 * Guards against the exact failure mode this exists to prevent: a missing
 * AI_PROVIDER_DEFAULT/AI_PROVIDER_<agentId> silently resolving to MockProvider
 * outside local/test. getAgentProvider() itself stays permissive — it always
 * returns a string and is safe to call eagerly (see providers/models.ts,
 * evaluated once at import for every agent regardless of whether that agent
 * ever runs in a given request). This assertion is deliberately NOT called
 * from there; it must run lazily, only at the point an agent is actually
 * about to be invoked (see orchestrator.ts's runAgent()), so a missing
 * provider var fails just that agent's run instead of crashing every route
 * that happens to import the agent config.
 *
 * An explicit, deliberate `AI_PROVIDER_DEFAULT=mock` (or per-agent override)
 * is respected in any environment — this only rejects the *silent*,
 * unconfigured fallback.
 */
export function assertAgentProviderConfigured(agentId: string): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "test") return;

  const perAgentKey = `AI_PROVIDER_${agentId}`;
  const configured = Boolean(process.env[perAgentKey]?.trim()) || Boolean(process.env.AI_PROVIDER_DEFAULT?.trim());
  if (configured) return;

  if (!isDeployedEnvironment()) return;

  throw new AIProviderConfigurationError(
    `AI provider is not configured for agent '${agentId}'. Set ${perAgentKey} or AI_PROVIDER_DEFAULT before running in Preview or Production — refusing to silently fall back to the mock provider.`,
  );
}

export function getAgentModel(agentId: string) {
  const modelEnvKey = `OPENAI_MODEL_${agentId.toUpperCase()}`;
  return process.env[modelEnvKey] ?? process.env.OPENAI_MODEL_DEFAULT ?? "gpt-4o-mini";
}

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const RUN_OPENAI_INTEGRATION_TESTS = process.env.RUN_OPENAI_INTEGRATION_TESTS === "true";
export const AI_DEV_ENDPOINT_SECRET = process.env.AI_DEV_ENDPOINT_SECRET;
