import type { AIProvider, InvokeOptions, ProviderHealth } from "./interface";
import OpenAI from "openai";
import { OPENAI_API_KEY } from "../config";
import type { ErrorCode } from "../errors/errors";

type OpenAIErrorShape = Error & { code?: string; name?: string; status?: number };
type OpenAIOutputContentPart = { text?: unknown };
type OpenAIOutputItem = { content?: unknown; text?: unknown };

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
  };
}

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

  async invoke(prompt: string, options?: InvokeOptions) {
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
      const response = await this.client.responses.create(
        {
          model,
          input: prompt,
          temperature,
          max_output_tokens: maxTokens,
        },
        { signal: controller.signal },
      );

      metadata.completedAt = new Date().toISOString();
      const completedAt = Date.now();
      const latencyMs = completedAt - startedAt;

      const usage = {
        inputTokens: typeof response?.usage?.input_tokens === "number" ? response.usage.input_tokens : undefined,
        outputTokens: typeof response?.usage?.output_tokens === "number" ? response.usage.output_tokens : undefined,
        totalTokens: typeof response?.usage?.total_tokens === "number" ? response.usage.total_tokens : undefined,
      };

      const output = this.extractOutput(response);

      return {
        providerId: this.id,
        model,
        requestId: response.id ?? null,
        success: true,
        output,
        usage,
        latencyMs,
        metadata,
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

  private extractOutput(response: unknown): unknown {
    const resp = response as {
      output?: unknown;
      output_text?: unknown;
      content?: unknown;
      response?: unknown;
    };

    if (!response) return null;
    if (typeof resp.output === "string") {
      return this.tryParseJson(resp.output);
    }

    if (Array.isArray(resp.output)) {
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
      return this.tryParseJson(text) ?? text;
    }

    if (typeof resp.output_text === "string") {
      return this.tryParseJson(resp.output_text) ?? resp.output_text;
    }

    if (resp.content) {
      if (typeof resp.content === "string") {
        return this.tryParseJson(resp.content) ?? resp.content;
      }
      if (Array.isArray(resp.content)) {
        const text = resp.content
          .map((item) => {
            if (typeof item === "string") return item;
            const typed = item as { text?: unknown };
            return typeof typed.text === "string" ? typed.text : "";
          })
          .join("");
        return this.tryParseJson(text) ?? text;
      }
    }

    const nested = resp.response as { output?: unknown } | undefined;
    if (nested?.output) {
      return this.extractOutput(resp.response);
    }

    return response;
  }

  private tryParseJson(value: unknown) {
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}

export default OpenAIProvider;
