import { describe, expect, it } from "vitest";
import { executeWithRetry, isTransientSupabaseError, SUPABASE_RETRY_POLICY } from "./repositories";

describe("Supabase transient retry classifier", () => {
  it("classifies only expected transient failures as retryable", () => {
    const retryableCases: Array<{ label: string; error: unknown }> = [
      { label: "network interruption", error: { message: "network interruption while calling Supabase" } },
      { label: "dns resolution failure", error: { message: "getaddrinfo ENOTFOUND api.supabase.co" } },
      { label: "connection reset", error: { message: "read ECONNRESET" } },
      { label: "timeout", error: { message: "request timed out after 10s" } },
      { label: "http 429", error: { message: "HTTP 429 Too Many Requests" } },
      { label: "http 502", error: { message: "status code 502 from upstream" } },
      { label: "http 503", error: { message: "HTTP 503 Service Unavailable" } },
      { label: "http 504", error: { message: "status: 504 gateway timeout" } },
      { label: "database deadlock", error: { code: "40P01", message: "deadlock detected" } },
      { label: "temporary serialization failure", error: { code: "40001", message: "could not serialize access" } },
    ];

    for (const testCase of retryableCases) {
      expect(isTransientSupabaseError(testCase.error), testCase.label).toBe(true);
    }
  });

  it("classifies expected hard failures as non-retryable", () => {
    const nonRetryableCases: Array<{ label: string; error: unknown }> = [
      { label: "unique constraint violation", error: { code: "23505", message: "duplicate key value violates unique constraint" } },
      { label: "foreign key violation", error: { code: "23503", message: "insert violates foreign key constraint" } },
      { label: "check constraint violation", error: { code: "23514", message: "new row violates check constraint" } },
      { label: "invalid input", error: { code: "22P02", message: "invalid input syntax for type uuid" } },
      { label: "authentication failure", error: { code: "28P01", message: "authentication failed for user" } },
      { label: "authorization / rls failure", error: { code: "42501", message: "permission denied for table projects due to row-level security" } },
      { label: "missing table", error: { code: "42P01", message: "relation projects does not exist" } },
      { label: "missing column", error: { code: "42703", message: "column metadata_json does not exist" } },
      { label: "schema mismatch", error: { message: "schema mismatch between request and database" } },
      { label: "malformed query", error: { code: "42601", message: "syntax error at or near FROM" } },
      { label: "application validation error", error: { message: "validation failed: required field missing" } },
    ];

    for (const testCase of nonRetryableCases) {
      expect(isTransientSupabaseError(testCase.error), testCase.label).toBe(false);
    }
  });
});

describe("Supabase retry execution behavior", () => {
  it("retries transient query-result errors and succeeds", async () => {
    let attempts = 0;

    const result = await executeWithRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        return {
          data: null,
          error: { message: "fetch failed: getaddrinfo ENOTFOUND api.supabase.co" },
        };
      }

      return {
        data: { ok: true },
        error: null,
      };
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ ok: true });
    expect(attempts).toBe(3);
  });

  it("does not retry non-retryable query-result errors", async () => {
    let attempts = 0;

    const result = await executeWithRetry(async () => {
      attempts += 1;
      return {
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      };
    });

    expect(result.error?.code).toBe("23505");
    expect(attempts).toBe(1);
  });

  it("does not retry non-retryable thrown errors", async () => {
    let attempts = 0;

    await expect(
      executeWithRetry(async () => {
        attempts += 1;
        throw new Error("permission denied for relation projects");
      }),
    ).rejects.toThrow("permission denied");

    expect(attempts).toBe(1);
  });

  it("uses linear backoff and stops at max attempts", async () => {
    let attempts = 0;

    const started = Date.now();
    const result = await executeWithRetry(async () => {
      attempts += 1;
      return {
        data: null,
        error: { code: "40001", message: "could not serialize access due to concurrent update" },
      };
    });
    const elapsedMs = Date.now() - started;

    expect(result.error?.code).toBe("40001");
    expect(attempts).toBe(SUPABASE_RETRY_POLICY.maxAttempts);

    // Two waits happen for maxAttempts=3: 100ms then 200ms.
    expect(elapsedMs).toBeGreaterThanOrEqual(280);
  });
});
