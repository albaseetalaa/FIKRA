import { describe, expect, it } from "vitest";
import { parseProviderRawResponse } from "../providers/responseParsing";

describe("response parsing guardrails", () => {
  it("does not recursively unwrap arbitrary strings", () => {
    const tripleWrapped = JSON.stringify(JSON.stringify(JSON.stringify({ a: 1 })));
    const result = parseProviderRawResponse(tripleWrapped, {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: false,
    });
    expect(result.parseSucceeded).toBe(false);
  });

  it("rejects prose containing an object fragment", () => {
    const text = "Sure, here is your model: {\"a\":1}";
    const result = parseProviderRawResponse(text, {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: false,
    });
    expect(result.classification).toBe("non_json_prose");
    expect(result.parseSucceeded).toBe(false);
  });
});
