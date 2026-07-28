import type { AIProvider, InvokeOptions, ProviderHealth } from "./interface";
import OpenAI from "openai";
import { OPENAI_API_KEY } from "../config";
import type { ErrorCode } from "../errors/errors";
import type { OutputModelName } from "../types/outputs";
import { getProviderOutputSchema, validateProviderStrictSchemaCompatibility } from "./outputSchemas";
import type { ProjectContext } from "../context";
import { parseProviderRawResponse } from "./responseParsing";
import type { ProviderParsingClassification, ProviderResponseFormat } from "../types/providerOutput";

type OpenAIErrorShape = Error & { code?: string; name?: string; status?: number };
type OpenAIOutputContentPart = { text?: unknown };
type OpenAIOutputItem = { content?: unknown; text?: unknown };
type OpenAIParsedItem = { parsed?: unknown };

export interface OpenAIResult {
  providerId: string;
  model: string;
  requestId: string | null;
  success: boolean;
  output: unknown;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  latencyMs: number;
  metadata: {
    startedAt: string;
    completedAt: string;
    model: string;
    provider: string;
    finishReason?: string | null;
    responseStatus?: string | null;
    responseFormat?: ProviderResponseFormat;
    outputType?: OutputModelName | null;
    parsingClassification?: ProviderParsingClassification;
    parsingStage?: string;
    incompleteReason?: string | null;
    responseCharLength?: number;
    configuredMaxOutputTokens?: number;
    parsedJson: boolean;
    rawResponseAvailable: boolean;
    rawResponseTruncated: boolean;
    refusalDetected: boolean;
    truncatedDetected: boolean;
  };
}

type OpenAIInvokeOptions = InvokeOptions & {
  outputModel?: OutputModelName;
  projectContext?: ProjectContext;
};

type ExtractionResult = {
  output: unknown;
  parsedJson: boolean;
  rawResponseAvailable: boolean;
  rawResponseTruncated: boolean;
  refusalDetected: boolean;
  truncatedDetected: boolean;
  finishReason: string | null;
  responseStatus: string | null;
  responseFormat: ProviderResponseFormat;
  outputType: OutputModelName | null;
  parsingClassification: ProviderParsingClassification;
  parsingStage: string;
  incompleteReason: string | null;
  responseCharLength: number;
};

export class OpenAIProviderError extends Error {
  code: ErrorCode;
  retryable: boolean;
  providerId: string;
  model: string;

  constructor(code: ErrorCode, message: string, retryable: boolean, providerId: string, model: string) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.providerId = providerId;
    this.model = model;
    Object.setPrototypeOf(this, OpenAIProviderError.prototype);
  }
}

export class OpenAIProvider implements AIProvider {
  id = "openai";
  name = "OpenAI";
  private client: OpenAI | null = null;

  constructor() {
    if (OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: OPENAI_API_KEY });
    }
  }

  async invoke(prompt: string, options?: OpenAIInvokeOptions) {
    if (!this.client) {
      throw new Error("OpenAI API key not configured");
    }

    const model = String(options?.model ?? "gpt-4o-mini");
    const temperature = typeof options?.temperature === "number" ? options.temperature : 0.2;
    const maxTokens = typeof options?.maxTokens === "number" ? options.maxTokens : 800;
    const timeoutMs = typeof options?.timeoutMs === "number" ? options.timeoutMs : 15000;
    const metadata = {
      startedAt: new Date().toISOString(),
      completedAt: "",
      model,
      provider: this.id,
    };
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const requestBody: Record<string, unknown> = {
        model,
        input: prompt,
        temperature,
        max_output_tokens: maxTokens,
      };

      const outputModel = options?.outputModel;
      const providerSchema = getProviderOutputSchema(outputModel, options?.projectContext);
      if (outputModel && providerSchema) {
        const compatibility = validateProviderStrictSchemaCompatibility(providerSchema);
        if (!compatibility.ok) {
          throw new OpenAIProviderError(
            "OPENAI_UNKNOWN_ERROR",
            `Provider schema compatibility check failed for ${outputModel}: ${compatibility.errors.join(" | ")}`,
            false,
            this.id,
            model,
          );
        }

        requestBody.text = {
          format: {
            type: "json_schema",
            name: outputModel,
            schema: providerSchema,
            strict: true,
          },
        };
      }

      const response = await this.client.responses.create(requestBody as never, { signal: controller.signal });

      metadata.completedAt = new Date().toISOString();
      const completedAt = Date.now();
      const latencyMs = completedAt - startedAt;

      const usage = {
        inputTokens: typeof response?.usage?.input_tokens === "number" ? response.usage.input_tokens : undefined,
        outputTokens: typeof response?.usage?.output_tokens === "number" ? response.usage.output_tokens : undefined,
        totalTokens: typeof response?.usage?.total_tokens === "number" ? response.usage.total_tokens : undefined,
      };

      const extraction = this.extractOutput(response, options?.outputModel);

      return {
        providerId: this.id,
        model,
        requestId: response.id ?? null,
        success: true,
        output: extraction.output,
        usage,
        latencyMs,
        metadata: {
          ...metadata,
          finishReason: extraction.finishReason,
          responseStatus: extraction.responseStatus,
          responseFormat: extraction.responseFormat,
          outputType: extraction.outputType,
          parsingClassification: extraction.parsingClassification,
          parsingStage: extraction.parsingStage,
          incompleteReason: extraction.incompleteReason,
          responseCharLength: extraction.responseCharLength,
          configuredMaxOutputTokens: maxTokens,
          parsedJson: extraction.parsedJson,
          rawResponseAvailable: extraction.rawResponseAvailable,
          rawResponseTruncated: extraction.rawResponseTruncated,
          refusalDetected: extraction.refusalDetected,
          truncatedDetected: extraction.truncatedDetected,
        },
      };
    } catch (error: unknown) {
      const openAiError = error as OpenAIErrorShape;
      let code: ErrorCode = "OPENAI_UNKNOWN_ERROR";
      let retryable = false;
      let message = openAiError.message ?? "Unknown OpenAI error";

      const isAbortError = openAiError.name === "AbortError" || openAiError.message?.toLowerCase().includes("aborted") || openAiError.message?.toLowerCase().includes("timed out");

      if (isAbortError) {
        code = "OPENAI_TIMEOUT";
        retryable = true;
        message = "OpenAI request timed out.";
      } else {
        const status = openAiError.status;
        if (typeof status === "number") {
          if (status === 401) {
            code = "OPENAI_AUTHENTICATION_ERROR";
            retryable = false;
          } else if (status === 429) {
            code = "OPENAI_RATE_LIMIT";
            retryable = true;
          } else if (status >= 500) {
            code = "OPENAI_SERVER_ERROR";
            retryable = true;
          } else if (status === 400) {
            code = "OPENAI_INVALID_REQUEST";
            retryable = false;
          } else if (status === 404) {
            code = "OPENAI_MODEL_UNAVAILABLE";
            retryable = false;
          } else {
            code = "OPENAI_UNKNOWN_ERROR";
            retryable = true;
          }
        } else if (openAiError.name === "OpenAIAPIError" || openAiError.name === "OpenAIError") {
          const status = openAiError.status;
          if (typeof status !== "number") {
            code = "OPENAI_UNKNOWN_ERROR";
            retryable = true;
          } else if (status === 401) {
            code = "OPENAI_AUTHENTICATION_ERROR";
            retryable = false;
          } else if (status === 429) {
            code = "OPENAI_RATE_LIMIT";
            retryable = true;
          } else if (status >= 500) {
            code = "OPENAI_SERVER_ERROR";
            retryable = true;
          } else if (status === 400) {
            code = "OPENAI_INVALID_REQUEST";
            retryable = false;
          } else if (status === 404) {
            code = "OPENAI_MODEL_UNAVAILABLE";
            retryable = false;
          } else {
            code = "OPENAI_UNKNOWN_ERROR";
            retryable = true;
          }
        } else if (openAiError.message?.includes("fetch")) {
          code = "OPENAI_NETWORK_ERROR";
          retryable = true;
        }
      }

      throw new OpenAIProviderError(code, message, retryable, this.id, model);
    } finally {
      clearTimeout(timeout);
    }
  }

  async health(): Promise<ProviderHealth> {
    if (!this.client) return { ok: false, message: "apiKey missing" };
    return { ok: true };
  }

  async models(): Promise<string[]> {
    return ["gpt-4o-mini", "gpt-4o", "gpt-4o-mini-structured"].filter(Boolean);
  }

  async validateConfiguration(): Promise<boolean> {
    return Boolean(this.client);
  }

  private extractOutput(response: unknown, outputModel?: OutputModelName): ExtractionResult {
    const resp = response as {
      output?: unknown;
      output_text?: unknown;
      content?: unknown;
      response?: unknown;
      status?: unknown;
      incomplete_details?: { reason?: unknown };
      text?: { format?: { type?: unknown } };
    };

    const responseStatus = typeof resp.status === "string" ? resp.status : null;
    const finishReason = typeof resp.incomplete_details?.reason === "string" ? resp.incomplete_details.reason : null;
    const responseFormat: ProviderResponseFormat =
      resp.text && typeof resp.text === "object"
      && typeof (resp.text as { format?: { type?: unknown } }).format?.type === "string"
        ? ((resp.text as { format?: { type?: ProviderResponseFormat } }).format?.type ?? "unknown")
        : "unknown";
    const incompleteReason = finishReason;
    const isIncompleteResponse = responseStatus === "incomplete" || finishReason === "max_output_tokens";

    const base = {
      parsedJson: false,
      rawResponseAvailable: false,
      rawResponseTruncated: false,
      refusalDetected: false,
      truncatedDetected: false,
      finishReason,
      responseStatus,
      responseFormat,
      outputType: outputModel ?? null,
      parsingClassification: "non_json_prose" as ProviderParsingClassification,
      parsingStage: "json_parse_failed",
      incompleteReason,
      responseCharLength: 0,
    };

    if (!response) {
      return {
        output: null,
        ...base,
      };
    }

    if (Array.isArray(resp.output)) {
      for (const item of resp.output) {
        const typed = item as OpenAIParsedItem;
        if (typed && typeof typed === "object" && "parsed" in typed) {
          const parsed = typed.parsed;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return {
              output: parsed,
              ...base,
              parsedJson: true,
              rawResponseAvailable: true,
              parsingClassification: "native_structured_object",
              parsingStage: "provider_native_parsed",
            };
          }
        }
      }
    }

    const parseText = (text: string) =>
      parseProviderRawResponse(text, {
        allowStringWrappedJson: true,
        allowSingleJsonCodeFence: true,
        isIncompleteResponse,
      });

    if (typeof resp.output === "string") {
      const parsed = parseText(resp.output);
      return {
        output: parsed.value,
        ...base,
        parsedJson: parsed.parseSucceeded,
        rawResponseAvailable: true,
        rawResponseTruncated: parsed.rawResponseTruncated,
        parsingClassification: parsed.classification,
        parsingStage: parsed.usedStringUnwrap
          ? "string_unwrap"
          : parsed.usedMarkdownCodeFenceStrip
            ? "markdown_json_strip"
            : parsed.parseSucceeded
              ? "json_text_parse"
              : "json_parse_failed",
        responseCharLength: parsed.responseCharLength,
        truncatedDetected: parsed.rawResponseTruncated,
      };
    }

    if (Array.isArray(resp.output)) {
      const refusalDetected = resp.output.some((item) => {
        const typed = item as { type?: unknown; content?: unknown };
        if (typed.type === "refusal") return true;
        if (Array.isArray(typed.content)) {
          return typed.content.some((segment) => (segment as { type?: unknown }).type === "refusal");
        }
        return false;
      });

      const text = resp.output
        .map((item) => {
          if (typeof item === "string") return item;
          const typed = item as OpenAIOutputItem;
          if (typed.content) {
            if (typeof typed.content === "string") return typed.content;
            if (Array.isArray(typed.content)) {
              return typed.content
                .map((c: unknown) => {
                  const segment = c as OpenAIOutputContentPart;
                  return typeof segment.text === "string" ? segment.text : "";
                })
                .join("");
            }
          }
          if (typeof typed.text === "string") return typed.text;
          return "";
        })
        .join("");
      const parsed = parseText(text);
      const parsingClassification = refusalDetected && !parsed.parseSucceeded
        ? "provider_refusal"
        : parsed.classification;
      return {
        output: parsed.value,
        ...base,
        parsedJson: parsed.parseSucceeded,
        rawResponseAvailable: text.trim().length > 0,
        rawResponseTruncated: parsed.rawResponseTruncated,
        parsingClassification,
        parsingStage: parsed.usedStringUnwrap
          ? "string_unwrap"
          : parsed.usedMarkdownCodeFenceStrip
            ? "markdown_json_strip"
            : parsed.parseSucceeded
              ? "json_text_parse"
              : "json_parse_failed",
        responseCharLength: parsed.responseCharLength,
        refusalDetected,
        truncatedDetected: parsed.rawResponseTruncated,
      };
    }

    if (typeof resp.output_text === "string") {
      const parsed = parseText(resp.output_text);
      return {
        output: parsed.value,
        ...base,
        parsedJson: parsed.parseSucceeded,
        rawResponseAvailable: true,
        rawResponseTruncated: parsed.rawResponseTruncated,
        parsingClassification: parsed.classification,
        parsingStage: parsed.usedStringUnwrap
          ? "string_unwrap"
          : parsed.usedMarkdownCodeFenceStrip
            ? "markdown_json_strip"
            : parsed.parseSucceeded
              ? "json_text_parse"
              : "json_parse_failed",
        responseCharLength: parsed.responseCharLength,
        truncatedDetected: parsed.rawResponseTruncated,
      };
    }

    if (resp.content) {
      if (typeof resp.content === "string") {
        const parsed = parseText(resp.content);
        return {
          output: parsed.value,
          ...base,
          parsedJson: parsed.parseSucceeded,
          rawResponseAvailable: true,
          rawResponseTruncated: parsed.rawResponseTruncated,
          parsingClassification: parsed.classification,
          parsingStage: parsed.usedStringUnwrap
            ? "string_unwrap"
            : parsed.usedMarkdownCodeFenceStrip
              ? "markdown_json_strip"
              : parsed.parseSucceeded
                ? "json_text_parse"
                : "json_parse_failed",
          responseCharLength: parsed.responseCharLength,
          truncatedDetected: parsed.rawResponseTruncated,
        };
      }
      if (Array.isArray(resp.content)) {
        const text = resp.content
          .map((item) => {
            if (typeof item === "string") return item;
            const typed = item as { text?: unknown };
            return typeof typed.text === "string" ? typed.text : "";
          })
          .join("");
        const parsed = parseText(text);
        return {
          output: parsed.value,
          ...base,
          parsedJson: parsed.parseSucceeded,
          rawResponseAvailable: text.trim().length > 0,
          rawResponseTruncated: parsed.rawResponseTruncated,
          parsingClassification: parsed.classification,
          parsingStage: parsed.usedStringUnwrap
            ? "string_unwrap"
            : parsed.usedMarkdownCodeFenceStrip
              ? "markdown_json_strip"
              : parsed.parseSucceeded
                ? "json_text_parse"
                : "json_parse_failed",
          responseCharLength: parsed.responseCharLength,
          truncatedDetected: parsed.rawResponseTruncated,
        };
      }
    }

    const nested = resp.response as { output?: unknown } | undefined;
    if (nested?.output) {
      return this.extractOutput(resp.response, outputModel);
    }

    return {
      output: response,
      ...base,
      rawResponseAvailable: true,
      rawResponseTruncated: finishReason === "max_output_tokens",
      parsingClassification: finishReason === "max_output_tokens" ? "truncated_json" : "non_json_prose",
      parsingStage: "json_parse_failed",
      truncatedDetected: finishReason === "max_output_tokens",
    };
  }
}

export default OpenAIProvider;
