import { describe, expect, it } from "vitest";
import { validateUserInputValues } from "../reliability";
import type { UserInputFieldDefinition } from "../reliability";

describe("pause/resume validation", () => {
  const fields: UserInputFieldDefinition[] = [
    {
      key: "additionalContext",
      label: "Additional Context",
      type: "textarea",
      required: true,
      constraints: { minLength: 3 },
    },
    {
      key: "estimatedBudget",
      label: "Estimated Budget",
      type: "number",
      required: false,
      constraints: { min: 1000, max: 1000000 },
    },
    {
      key: "consent",
      label: "Consent",
      type: "boolean",
      required: true,
    },
    {
      key: "marketTier",
      label: "Market Tier",
      type: "select",
      required: true,
      options: [
        { value: "local", label: "Local" },
        { value: "regional", label: "Regional" },
        { value: "global", label: "Global" },
      ],
    },
  ];

  it("validates and normalizes supported field types", () => {
    const result = validateUserInputValues(fields, {
      additionalContext: "Detailed scope and constraints",
      estimatedBudget: "25000",
      consent: "true",
      marketTier: "regional",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized.estimatedBudget).toBe(25000);
      expect(result.normalized.consent).toBe(true);
      expect(result.normalized.marketTier).toBe("regional");
    }
  });

  it("rejects missing required fields", () => {
    const result = validateUserInputValues(fields, {
      estimatedBudget: 5000,
      consent: true,
      marketTier: "local",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Missing required field 'additionalContext'");
    }
  });

  it("rejects invalid select and boolean values", () => {
    const invalidSelect = validateUserInputValues(fields, {
      additionalContext: "Context",
      consent: true,
      marketTier: "planetary",
    });

    expect(invalidSelect.ok).toBe(false);
    if (!invalidSelect.ok) {
      expect(invalidSelect.message).toContain("invalid option");
    }

    const invalidBoolean = validateUserInputValues(fields, {
      additionalContext: "Context",
      consent: "yes",
      marketTier: "local",
    });

    expect(invalidBoolean.ok).toBe(false);
    if (!invalidBoolean.ok) {
      expect(invalidBoolean.message).toContain("must be boolean");
    }
  });
});
