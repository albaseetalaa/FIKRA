import { describe, expect, it } from "vitest";
import { formatCurrencyMismatchNotice, syncCurrencyForCountry } from "./currencySync";
import { suggestCurrencyForCountry } from "@/ai/context/budgetTimelineOptions";

describe("syncCurrencyForCountry", () => {
  it("Saudi Arabia suggests SAR, then changing country to Jordan replaces it with JOD", () => {
    const afterSaudi = syncCurrencyForCountry({}, "Saudi Arabia", suggestCurrencyForCountry);
    expect(afterSaudi.currency).toBe("SAR");
    expect(afterSaudi.currencyInputMode).toBe("suggested");

    const afterJordan = syncCurrencyForCountry(afterSaudi, "Jordan", suggestCurrencyForCountry);
    expect(afterJordan.currency).toBe("JOD");
    expect(afterJordan.currencyInputMode).toBe("suggested");
  });

  it("a manually-selected currency is preserved across a later country change", () => {
    const afterJordan = syncCurrencyForCountry({}, "Jordan", suggestCurrencyForCountry);
    expect(afterJordan.currency).toBe("JOD");

    const manual: typeof afterJordan = { currency: "USD", currencyInputMode: "manual" };
    const afterCountryChange = syncCurrencyForCountry(manual, "Saudi Arabia", suggestCurrencyForCountry);

    expect(afterCountryChange.currency).toBe("USD");
    expect(afterCountryChange.currencyInputMode).toBe("manual");
  });

  it("clears a country-suggested currency when the new country has no suggestion", () => {
    const afterJordan = syncCurrencyForCountry({}, "Jordan", suggestCurrencyForCountry);
    const afterUnknownCountry = syncCurrencyForCountry(afterJordan, "Atlantis", suggestCurrencyForCountry);

    expect(afterUnknownCountry.currency).toBeUndefined();
    expect(afterUnknownCountry.currencyInputMode).toBe("suggested");
  });

  it("never overrides a manual currency even when the country has no suggestion", () => {
    const manual: CurrencySyncStateFixture = { currency: "USD", currencyInputMode: "manual" };
    const result = syncCurrencyForCountry(manual, "Atlantis", suggestCurrencyForCountry);

    expect(result.currency).toBe("USD");
    expect(result.currencyInputMode).toBe("manual");
  });
});

type CurrencySyncStateFixture = { currency?: string; currencyInputMode?: "suggested" | "manual" };

describe("formatCurrencyMismatchNotice", () => {
  it("shows the exact mismatch message for a manual currency that differs from the country's suggestion", () => {
    expect(formatCurrencyMismatchNotice("Jordan", "USD", "JOD")).toBe(
      "Suggested currency for Jordan is JOD. Your selected currency is USD.",
    );
  });
});
