/**
 * A same-origin relative path: starts with exactly one "/", contains no
 * whitespace or backslash (both of which browsers can use to smuggle a
 * protocol-relative or absolute URL past a naive "starts with /" check).
 */
const SAFE_NEXT_PATH_PATTERN = /^\/(?!\/)[^\s\\]*$/;

/**
 * Validates an untrusted "next" redirect target (from a query string or
 * form field) against open-redirect payloads and returns a safe relative
 * path, or `fallback` if the input isn't one.
 */
export function sanitizeNextPath(
  value: string | string[] | null | undefined,
  fallback: string,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate !== "string" || candidate.length === 0) {
    return fallback;
  }

  return SAFE_NEXT_PATH_PATTERN.test(candidate) ? candidate : fallback;
}
