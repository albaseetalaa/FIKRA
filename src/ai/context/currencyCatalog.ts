// Centralized currency validation, shared by onboarding UI, the create
// route, and tests. Never duplicate this list or logic elsewhere.
//
// Validates both shape (3 uppercase letters) AND that the code is a real
// ISO-4217 currency — a bare shape check would accept fabricated codes
// like "AAA"/"XYZ" as if they were real, which is exactly the kind of
// silent-wrong-currency problem Batch A exists to close.
//
// Prefers Intl.supportedValuesOf("currency") (native, standards-based,
// available in Node >=18 and evergreen browsers) when the runtime
// supports it, so the accepted set tracks the platform's real ICU/CLDR
// currency data rather than a list that goes stale. Falls back to a
// deterministic, checked-in snapshot of that same list (captured from
// Node 24's ICU data) for any environment where the API is unavailable.

const FALLBACK_CURRENCY_CODES: readonly string[] = [
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL",
  "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY",
  "COP", "CRC", "CUC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD",
  "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP",
  "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF", "IDR",
  "ILS", "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS",
  "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR",
  "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP",
  "MRU", "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO",
  "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN",
  "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG",
  "SEK", "SGD", "SHP", "SLE", "SLL", "SOS", "SRD", "SSP", "STN", "SVC",
  "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD",
  "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST",
  "XAF", "XCD", "XCG", "XDR", "XOF", "XPF", "XSU", "YER", "ZAR", "ZMW",
  "ZWG", "ZWL",
];

type IntlWithSupportedValuesOf = typeof Intl & {
  supportedValuesOf?: (key: string) => string[];
};

let cachedSupportedCurrencies: ReadonlySet<string> | null = null;

function loadSupportedCurrencies(): ReadonlySet<string> {
  if (cachedSupportedCurrencies) return cachedSupportedCurrencies;

  const intlWithSupportedValuesOf = Intl as IntlWithSupportedValuesOf;
  if (typeof intlWithSupportedValuesOf.supportedValuesOf === "function") {
    try {
      cachedSupportedCurrencies = new Set(intlWithSupportedValuesOf.supportedValuesOf("currency"));
      return cachedSupportedCurrencies;
    } catch {
      // Environment claims support but the call failed; fall through to
      // the deterministic checked-in list below.
    }
  }

  cachedSupportedCurrencies = new Set(FALLBACK_CURRENCY_CODES);
  return cachedSupportedCurrencies;
}

const CURRENCY_CODE_SHAPE = /^[A-Z]{3}$/;

export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
}

export function isValidCurrencyCode(value: unknown): value is string {
  const normalized = normalizeCurrencyCode(value);
  if (!normalized || !CURRENCY_CODE_SHAPE.test(normalized)) return false;
  return loadSupportedCurrencies().has(normalized);
}

export function listSupportedCurrencyCodes(): readonly string[] {
  return Array.from(loadSupportedCurrencies()).sort();
}
