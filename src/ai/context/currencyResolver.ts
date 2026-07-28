import type { CurrencyResolution } from "./types";

const countryCurrencyMap: Record<string, string> = {
  jordan: "JOD",
  "saudi arabia": "SAR",
  "united states": "USD",
  "united states of america": "USD",
  "united kingdom": "GBP",
  "united arab emirates": "AED",
};

function parseBudgetCurrency(budgetRange?: string | null): string | null {
  if (!budgetRange) return null;
  const upper = budgetRange.toUpperCase();
  const match = upper.match(/\b([A-Z]{3})\b/);
  return match?.[1] ?? null;
}

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

  const budgetCurrency = input.budgetCurrency?.trim().toUpperCase() ?? parseBudgetCurrency(input.budgetRange);
  if (budgetCurrency) {
    return {
      currencyCode: budgetCurrency,
      resolutionSource: "budget_hint",
      confidence: 0.85,
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

  const countryKey = input.country?.trim().toLowerCase() ?? "";
  const byCountry = countryCurrencyMap[countryKey];
  if (byCountry) {
    return {
      currencyCode: byCountry,
      resolutionSource: "country_default",
      confidence: 0.8,
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
