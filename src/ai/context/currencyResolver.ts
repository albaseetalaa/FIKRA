import type { CurrencyResolution } from "./types";

export const countryCurrencyMap: Record<string, string> = {
  jordan: "JOD",
  "saudi arabia": "SAR",
  "united states": "USD",
  "united states of america": "USD",
  "united kingdom": "GBP",
  "united arab emirates": "AED",
};

export function defaultCurrencyForCountry(country?: string | null): string | null {
  if (!country) return null;
  return countryCurrencyMap[country.trim().toLowerCase()] ?? null;
}

function parseBudgetCurrency(budgetRange?: string | null): string | null {
  if (!budgetRange) return null;
  const upper = budgetRange.toUpperCase();
  const match = upper.match(/\b([A-Z]{3})\b/);
  return match?.[1] ?? null;
}

/**
 * Resolution priority, most to least authoritative:
 *   1. explicitCurrency  — the project's own explicit currency selection.
 *      New onboarding always sets this, so every project created after
 *      Batch A resolves here and nothing below this line ever runs for it.
 *   2. projectCurrency   — a configured project-level override (currently
 *      unused by any caller; kept for forward compatibility).
 *   3. country default   — resolved from the project's country. This is
 *      checked BEFORE the free-text budget-hint parse below so that a
 *      stray 3-letter currency-looking token inside an old free-text
 *      budget value (e.g. a legacy record's "Under SAR 5,000") can never
 *      silently override a confidently-known country. This branch is what
 *      keeps legacy Jordan projects resolving to JOD. When a budget-hint
 *      token is ALSO present and disagrees with the country default, the
 *      resolution source is reported as "legacy_country_fallback" instead
 *      of the plain "country_default", so the suppression is observable
 *      rather than silent.
 *   4. budget-hint        — a currency code parsed out of free-text budget
 *      input. Only ever reached when country could not resolve a currency.
 *      This exists solely to serve legacy records created before an
 *      explicit currency field existed; new onboarding submissions always
 *      short-circuit at step 1 and never reach this branch.
 *   5. unresolved.
 */
export function resolveCurrency(input: {
  explicitCurrency?: string | null;
  budgetCurrency?: string | null;
  budgetRange?: string | null;
  projectCurrency?: string | null;
  country?: string | null;
}): CurrencyResolution {
  const explicit = input.explicitCurrency?.trim().toUpperCase();
  if (explicit) {
    return {
      currencyCode: explicit,
      resolutionSource: "user_selected",
      confidence: 1,
      requiresConfirmation: false,
    };
  }

  const configured = input.projectCurrency?.trim().toUpperCase();
  if (configured) {
    return {
      currencyCode: configured,
      resolutionSource: "project_config",
      confidence: 0.9,
      requiresConfirmation: false,
    };
  }

  const budgetHintCandidate = input.budgetCurrency?.trim().toUpperCase() || parseBudgetCurrency(input.budgetRange);

  const byCountry = defaultCurrencyForCountry(input.country);
  if (byCountry) {
    const suppressedConflictingHint = Boolean(budgetHintCandidate) && budgetHintCandidate !== byCountry;
    return {
      currencyCode: byCountry,
      resolutionSource: suppressedConflictingHint ? "legacy_country_fallback" : "country_default",
      confidence: 0.8,
      requiresConfirmation: false,
    };
  }

  if (budgetHintCandidate) {
    return {
      currencyCode: budgetHintCandidate,
      resolutionSource: "budget_hint",
      confidence: 0.85,
      requiresConfirmation: false,
    };
  }

  return {
    currencyCode: null,
    resolutionSource: "unresolved",
    confidence: 0,
    requiresConfirmation: true,
  };
}
