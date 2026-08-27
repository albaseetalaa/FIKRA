// Centralized currency validation, shared by onboarding UI, the create
// route, and tests. Never duplicate this list or logic elsewhere.
//
// Validates both shape (3 uppercase letters) AND that the code is a real
// ISO-4217 currency — a bare shape check would accept fabricated codes
// like "AAA"/"XYZ" as if they were real, which is exactly the kind of
// silent-wrong-currency problem this module exists to close.
//
// This list is the single, deterministic source of truth for FIKRA's
// supported currencies. It intentionally does NOT consult
// Intl.supportedValuesOf("currency") at runtime: some Android WebViews
// ship a reduced ("small-ICU") ICU dataset where that API exists and
// succeeds, but silently omits real, valid codes such as JOD. Relying on
// it made currency acceptance depend on which runtime happened to handle
// the request, rejecting currencies FIKRA itself considers valid. This
// checked-in snapshot (captured from Node 24's full ICU data) behaves
// identically on every client, server, and test runtime.

const SUPPORTED_CURRENCY_CODES: ReadonlySet<string> = new Set([
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
]);

const CURRENCY_CODE_SHAPE = /^[A-Z]{3}$/;

export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
}

export function isValidCurrencyCode(value: unknown): value is string {
  const normalized = normalizeCurrencyCode(value);
  if (!normalized || !CURRENCY_CODE_SHAPE.test(normalized)) return false;
  return SUPPORTED_CURRENCY_CODES.has(normalized);
}

export function listSupportedCurrencyCodes(): readonly string[] {
  return Array.from(SUPPORTED_CURRENCY_CODES).sort();
}
