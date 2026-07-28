import { describe, expect, it } from "vitest";
import { sanitizeDiagnosticForLogs, type ValidationDiagnostic } from "../validation/diagnostics";

describe("validation diagnostic sanitization", () => {
  it("returns a sanitized diagnostic object without raw output", () => {
    const diagnostic: ValidationDiagnostic = {
      agentId: "business_strategist",
      outputType: "BusinessPlan",
      provider: "openai",
      model: "gpt-4o-mini",
      responseFormat: "json_schema",
      validationStage: "schema_validation",
      parsingStage: "json_text_parse",
      parsingClassification: "valid_json_text",
      schemaIssues: [{ path: "executiveSummary", code: "invalid_type", message: "Required" }],
      semanticIssues: [],
      retryable: true,
      rawResponseAvailable: true,
      rawResponseTruncated: false,
      finishReason: null,
      incompleteReason: null,
      responseStatus: "completed",
      outputTokens: 420,
      configuredOutputTokenLimit: 1200,
      responseCharLength: 1800,
      generatedAt: "2026-07-28T00:00:00.000Z",
      parseSucceeded: true,
      parseFailed: false,
      invalidJson: false,
      providerRefusal: false,
      incompleteResponse: false,
      projectContextMismatch: false,
      unknownAdditionalFields: [],
    };

    const sanitized = sanitizeDiagnosticForLogs(diagnostic) as Record<string, unknown>;
    expect(sanitized.agentId).toBe("business_strategist");
    expect(sanitized.outputType).toBe("BusinessPlan");
    expect("rawOutput" in sanitized).toBe(false);
  });
});
