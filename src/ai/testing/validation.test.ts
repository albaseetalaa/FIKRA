import { describe, it, expect } from "vitest";
import { validateModel } from "../validation/validator";
import mocks from "./mocks";

describe("Validator", () => {
  it("accepts a valid BusinessPlan", () => {
    const r = validateModel("BusinessPlan", mocks.validBusinessPlan);
    expect(r.success).toBe(true);
  });

  it("rejects an invalid BusinessPlan", () => {
    const r = validateModel("BusinessPlan", mocks.invalidBusinessPlan as unknown);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors.length).toBeGreaterThan(0);
    }
  });

  it("detects malformed JSON as failure when parsing", () => {
    const r = validateModel("BusinessPlan", mocks.malformedResponse as unknown);
    expect(r.success).toBe(false);
  });
});
