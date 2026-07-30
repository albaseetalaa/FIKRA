import { z } from "zod";

/**
 * Validated environment variables.
 *
 * Import `env` instead of reading `process.env` directly. This fails
 * fast at build/start time with a clear message if a required variable
 * is missing or malformed, instead of failing later inside whatever
 * code first happens to touch `process.env`.
 *
 * Only NEXT_PUBLIC_-prefixed variables are ever inlined into the
 * browser bundle by Next.js — server-only variables below (e.g.
 * SUPABASE_SERVICE_ROLE_KEY) remain undefined on the client and are
 * safe to include in a single shared schema.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url("NEXT_PUBLIC_SITE_URL must be a valid URL")
    .optional(),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL")
    .optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY must not be empty")
    .optional(),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY must not be empty")
    .optional(),
  SUPABASE_URL: z
    .string()
    .url("SUPABASE_URL must be a valid URL")
    .optional(),
  AI_PERSISTENCE_PROVIDER: z
    .enum(["memory", "supabase"])
    .default("memory"),
  RUN_SUPABASE_INTEGRATION_TESTS: z
    .enum(["true", "false"])
    .optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment variables:\n${formatted}\n\nCheck .env.example for the expected shape.`,
    );
  }

  return result.data;
}

export const env = parseEnv();

/**
 * True when browser-facing Supabase configuration is available.
 *
 * Server-side AI persistence additionally requires SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, and AI_PERSISTENCE_PROVIDER=supabase.
 */
export const isSupabaseConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
