export function normalizeProviderResponse(response: unknown): unknown {
  if (typeof response === "string") {
    try {
      return JSON.parse(response);
    } catch {
      return response;
    }
  }

  if (response && typeof response === "object") {
    const obj = response as Record<string, unknown>;
    if (obj.output !== undefined) {
      return normalizeProviderResponse(obj.output);
    }
    if (obj.result !== undefined) {
      return normalizeProviderResponse(obj.result);
    }
    if (obj.response !== undefined) {
      return normalizeProviderResponse(obj.response);
    }
  }

  return response;
}
