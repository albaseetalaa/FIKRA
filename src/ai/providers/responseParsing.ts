import type { ProviderParsingClassification } from "../types/providerOutput";

type ParseResponseOptions = {
  allowStringWrappedJson?: boolean;
  allowSingleJsonCodeFence?: boolean;
  isIncompleteResponse?: boolean;
  isProviderRefusal?: boolean;
};

export type ParseResponseResult = {
  value: unknown;
  classification: ProviderParsingClassification;
  parseSucceeded: boolean;
  rawResponseAvailable: boolean;
  rawResponseTruncated: boolean;
  incompleteProviderResponse: boolean;
  usedStringUnwrap: boolean;
  usedMarkdownCodeFenceStrip: boolean;
  responseCharLength: number;
};

const JSON_CODE_BLOCK = /^\s*```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i;

function looksLikeTruncatedJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const opens = (trimmed.match(/[\[{]/g) ?? []).length;
  const closes = (trimmed.match(/[\]}]/g) ?? []).length;
  if (opens > closes) return true;
  if (trimmed.startsWith("{") && !trimmed.endsWith("}")) return true;
  if (trimmed.startsWith("[") && !trimmed.endsWith("]")) return true;
  return false;
}

function parseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hasLikelyProse(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /[a-z]{3,}\s+[a-z]{3,}/i.test(trimmed) && !trimmed.startsWith("{") && !trimmed.startsWith("[") && !trimmed.startsWith('"');
}

export function parseProviderRawResponse(raw: unknown, options: ParseResponseOptions = {}): ParseResponseResult {
  const isIncompleteResponse = Boolean(options.isIncompleteResponse);
  const isProviderRefusal = Boolean(options.isProviderRefusal);

  if (isProviderRefusal) {
    return {
      value: raw,
      classification: "provider_refusal",
      parseSucceeded: false,
      rawResponseAvailable: raw != null,
      rawResponseTruncated: false,
      incompleteProviderResponse: isIncompleteResponse,
      usedStringUnwrap: false,
      usedMarkdownCodeFenceStrip: false,
      responseCharLength: typeof raw === "string" ? raw.length : 0,
    };
  }

  if (typeof raw !== "string") {
    return {
      value: raw,
      classification: "native_structured_object",
      parseSucceeded: raw !== null && typeof raw === "object" && !Array.isArray(raw),
      rawResponseAvailable: raw != null,
      rawResponseTruncated: false,
      incompleteProviderResponse: isIncompleteResponse,
      usedStringUnwrap: false,
      usedMarkdownCodeFenceStrip: false,
      responseCharLength: 0,
    };
  }

  const responseCharLength = raw.length;
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      value: raw,
      classification: isIncompleteResponse ? "incomplete_provider_response" : "non_json_prose",
      parseSucceeded: false,
      rawResponseAvailable: false,
      rawResponseTruncated: isIncompleteResponse,
      incompleteProviderResponse: isIncompleteResponse,
      usedStringUnwrap: false,
      usedMarkdownCodeFenceStrip: false,
      responseCharLength,
    };
  }

  if (isIncompleteResponse && looksLikeTruncatedJson(trimmed)) {
    return {
      value: raw,
      classification: "truncated_json",
      parseSucceeded: false,
      rawResponseAvailable: true,
      rawResponseTruncated: true,
      incompleteProviderResponse: true,
      usedStringUnwrap: false,
      usedMarkdownCodeFenceStrip: false,
      responseCharLength,
    };
  }

  const direct = parseJson(trimmed);
  if (direct !== null) {
    if (typeof direct === "object" && direct !== null && !Array.isArray(direct)) {
      return {
        value: direct,
        classification: "valid_json_text",
        parseSucceeded: true,
        rawResponseAvailable: true,
        rawResponseTruncated: false,
        incompleteProviderResponse: isIncompleteResponse,
        usedStringUnwrap: false,
        usedMarkdownCodeFenceStrip: false,
        responseCharLength,
      };
    }

    if (typeof direct === "string" && options.allowStringWrappedJson && !isIncompleteResponse) {
      const unwrapped = parseJson(direct.trim());
      if (unwrapped !== null && typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped)) {
        return {
          value: unwrapped,
          classification: "string_wrapped_json",
          parseSucceeded: true,
          rawResponseAvailable: true,
          rawResponseTruncated: false,
          incompleteProviderResponse: false,
          usedStringUnwrap: true,
          usedMarkdownCodeFenceStrip: false,
          responseCharLength,
        };
      }
      return {
        value: raw,
        classification: "malformed_json",
        parseSucceeded: false,
        rawResponseAvailable: true,
        rawResponseTruncated: false,
        incompleteProviderResponse: false,
        usedStringUnwrap: true,
        usedMarkdownCodeFenceStrip: false,
        responseCharLength,
      };
    }

    return {
      value: raw,
      classification: "malformed_json",
      parseSucceeded: false,
      rawResponseAvailable: true,
      rawResponseTruncated: false,
      incompleteProviderResponse: isIncompleteResponse,
      usedStringUnwrap: false,
      usedMarkdownCodeFenceStrip: false,
      responseCharLength,
    };
  }

  const fenceMatch = options.allowSingleJsonCodeFence ? trimmed.match(JSON_CODE_BLOCK) : null;
  if (fenceMatch && !isIncompleteResponse) {
    const inside = (fenceMatch[1] ?? "").trim();
    const parsed = parseJson(inside);
    if (parsed !== null && typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return {
        value: parsed,
        classification: "markdown_wrapped_json",
        parseSucceeded: true,
        rawResponseAvailable: true,
        rawResponseTruncated: false,
        incompleteProviderResponse: false,
        usedStringUnwrap: false,
        usedMarkdownCodeFenceStrip: true,
        responseCharLength,
      };
    }
  }

  if (looksLikeTruncatedJson(trimmed)) {
    return {
      value: raw,
      classification: isIncompleteResponse ? "truncated_json" : "malformed_json",
      parseSucceeded: false,
      rawResponseAvailable: true,
      rawResponseTruncated: isIncompleteResponse,
      incompleteProviderResponse: isIncompleteResponse,
      usedStringUnwrap: false,
      usedMarkdownCodeFenceStrip: false,
      responseCharLength,
    };
  }

  if (isIncompleteResponse) {
    return {
      value: raw,
      classification: "incomplete_provider_response",
      parseSucceeded: false,
      rawResponseAvailable: true,
      rawResponseTruncated: false,
      incompleteProviderResponse: true,
      usedStringUnwrap: false,
      usedMarkdownCodeFenceStrip: false,
      responseCharLength,
    };
  }

  return {
    value: raw,
    classification: hasLikelyProse(trimmed) ? "non_json_prose" : "malformed_json",
    parseSucceeded: false,
    rawResponseAvailable: true,
    rawResponseTruncated: false,
    incompleteProviderResponse: false,
    usedStringUnwrap: false,
    usedMarkdownCodeFenceStrip: false,
    responseCharLength,
  };
}
