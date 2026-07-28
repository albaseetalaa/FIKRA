export function normalizeProviderResponse(response: unknown): unknown {
  if (typeof response === "string") {
    const trimmed = response.trim();

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") {
        try {
          const unwrapped = JSON.parse(parsed.trim());
          if (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped)) {
            return unwrapped;
          }
        } catch {
          return response;
        }
      }
      return parsed;
    } catch {
      const fence = trimmed.match(/^\s*```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i);
      if (fence) {
        const inside = (fence[1] ?? "").trim();
        try {
          return JSON.parse(inside);
        } catch {
          return response;
        }
      }
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
