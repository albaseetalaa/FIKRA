import { describe, expect, it } from "vitest";
import { parseProviderRawResponse } from "../providers/responseParsing";
import { getProviderOutputSchema } from "../providers/outputSchemas";
import { FinancialModelSchema } from "../schemas/schemas";
import { validFinancialModel } from "./mocks";

describe("FinancialModel parsing reliability", () => {
  it("accepts valid JSON text", () => {
    const raw = JSON.stringify(validFinancialModel);
    const parsed = parseProviderRawResponse(raw, {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: false,
    });
    expect(parsed.classification).toBe("valid_json_text");
    expect(parsed.parseSucceeded).toBe(true);
    expect(FinancialModelSchema.safeParse(parsed.value).success).toBe(true);
  });

  it("accepts one-step string wrapped JSON object", () => {
    const raw = JSON.stringify(JSON.stringify(validFinancialModel));
    const parsed = parseProviderRawResponse(raw, {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: false,
    });
    expect(parsed.classification).toBe("string_wrapped_json");
    expect(parsed.parseSucceeded).toBe(true);
  });

  it("rejects nested/repeated wrapped JSON strings", () => {
    const nested = JSON.stringify(JSON.stringify(JSON.stringify(validFinancialModel)));
    const parsed = parseProviderRawResponse(nested, {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: false,
    });
    expect(parsed.parseSucceeded).toBe(false);
  });

  it("accepts complete single markdown JSON code fence", () => {
    const raw = `\n\`\`\`json\n${JSON.stringify(validFinancialModel)}\n\`\`\`\n`;
    const parsed = parseProviderRawResponse(raw, {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: false,
    });
    expect(parsed.classification).toBe("markdown_wrapped_json");
    expect(parsed.parseSucceeded).toBe(true);
  });

  it("rejects JSON with surrounding prose", () => {
    const raw = `Here is your result:\n${JSON.stringify(validFinancialModel)}`;
    const parsed = parseProviderRawResponse(raw, {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: false,
    });
    expect(parsed.parseSucceeded).toBe(false);
    expect(parsed.classification).toBe("non_json_prose");
  });

  it("classifies malformed JSON", () => {
    const parsed = parseProviderRawResponse('{"verticalId":"x"', {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: false,
    });
    expect(parsed.classification).toBe("malformed_json");
  });

  it("classifies truncated JSON when incomplete", () => {
    const parsed = parseProviderRawResponse('{"verticalId":"x"', {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: true,
    });
    expect(parsed.classification).toBe("truncated_json");
  });

  it("classifies incomplete provider response with non-json content", () => {
    const parsed = parseProviderRawResponse("working...", {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: true,
    });
    expect(parsed.classification).toBe("incomplete_provider_response");
  });

  it("keeps FinancialModel schema arrays bounded and scenario count exact", () => {
    const schema = getProviderOutputSchema("FinancialModel") as Record<string, unknown>;
    const props = (schema.properties as Record<string, unknown>);
    const forecast = props.financialForecast as Record<string, unknown>;
    expect(forecast.minItems).toBe(3);
    expect(forecast.maxItems).toBe(3);
    expect((props.startupCosts as Record<string, unknown>).maxItems).toBe(15);
    expect((props.operatingCosts as Record<string, unknown>).maxItems).toBe(20);
  });
});
