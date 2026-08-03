// Pure currency/country sync logic for the onboarding wizard, extracted so
// it can be unit tested without mounting the React component (this repo has
// no DOM-testing setup, so component-level tests aren't an option here).
//
// currencyInputMode tracks provenance: "suggested" means the visible
// currency still reflects the country's default and should follow it when
// the country changes; "manual" means the user edited it, so later country
// changes must never overwrite it. currencyInputMode is wizard/draft UI
// state only — it must never be sent to the API or persisted as project
// business data (see submitProject.ts's explicit payload allowlist).

export type CurrencyInputMode = "suggested" | "manual";

export interface CurrencySyncState {
  currency?: string;
  currencyInputMode?: CurrencyInputMode;
}

export function syncCurrencyForCountry(
  state: CurrencySyncState,
  country: string | undefined,
  suggestCurrency: (country?: string | null) => string | null,
): CurrencySyncState {
  if (state.currencyInputMode === "manual") {
    return state;
  }

  const suggested = suggestCurrency(country);
  if (suggested) {
    return { currency: suggested, currencyInputMode: "suggested" };
  }

  if (state.currencyInputMode === "suggested") {
    return { currency: undefined, currencyInputMode: state.currencyInputMode };
  }

  return state;
}

export function formatCurrencyMismatchNotice(country: string | undefined, currentCurrency: string, suggestedCurrency: string): string {
  return `Suggested currency for ${country} is ${suggestedCurrency}. Your selected currency is ${currentCurrency}.`;
}
