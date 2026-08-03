import { describe, expect, it } from "vitest";
import { OpenAIProvider } from "../providers/openaiProvider";
import { getProviderOutputSchema, validateProviderStrictSchemaCompatibility } from "../providers/outputSchemas";
import type { ProjectContext } from "../context";
import { createProjectContextFixture } from "../context";

const eggreenContext: ProjectContext = createProjectContextFixture({
  projectId: "proj_eggreen",
  businessName: "Eggreen",
  businessDescription: "Healthy breakfast restaurant",
  budgetRange: null,
  launchTimeline: "Within 3 months",
});

describe("provider structured output", () => {
  it("selects provider schema by output type", () => {
    expect(getProviderOutputSchema("BusinessPlan")).not.toBeNull();
    expect(getProviderOutputSchema("MarketResearchReport")).not.toBeNull();
    expect(getProviderOutputSchema("FinancialModel")).not.toBeNull();
    expect(getProviderOutputSchema("ProjectScore")).toBeNull();
  });

  it("passes strict provider schema compatibility checks for all supported structured output types", () => {
    for (const outputType of ["BusinessPlan", "MarketResearchReport", "FinancialModel"] as const) {
      const schema = getProviderOutputSchema(outputType);
      expect(schema).not.toBeNull();
      const compatibility = validateProviderStrictSchemaCompatibility(schema as Record<string, unknown>);
      expect(compatibility.ok, `${outputType}: ${compatibility.errors.join(" | ")}`).toBe(true);
    }
  });

  it("applies authoritative BusinessPlan context enums dynamically", () => {
    const schema = getProviderOutputSchema("BusinessPlan", eggreenContext) as Record<string, unknown>;
    const properties = schema.properties as Record<string, Record<string, unknown>>;

    expect(properties.businessVertical?.enum).toEqual(["restaurant_food_service"]);
    expect(properties.primaryRevenueModel?.enum).toEqual(["transaction_sales"]);
    expect(properties.currency?.enum).toEqual(["JOD"]);
  });

  it("applies authoritative FinancialModel context enums dynamically", () => {
    const schema = getProviderOutputSchema("FinancialModel", eggreenContext) as Record<string, unknown>;
    const properties = schema.properties as Record<string, Record<string, unknown>>;

    expect(properties.verticalId?.enum).toEqual(["restaurant_food_service"]);
    expect(properties.revenueModelType?.enum).toEqual(["transaction_sales"]);
  });

  it("uses OpenAI json_schema format for supported output models", async () => {
    const provider = new OpenAIProvider();

    let capturedBody: Record<string, unknown> | null = null;

    Object.defineProperty(provider as unknown as Record<string, unknown>, "client", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: {
        responses: {
          create: async (body: Record<string, unknown>) => {
            capturedBody = body;
            return {
              id: "resp_1",
              usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
              output_text: "{\"executiveSummary\":\"ok\"}",
            };
          },
        },
      },
    });

    await provider.invoke("test prompt", {
      outputModel: "BusinessPlan",
      model: "gpt-4o-mini",
      maxTokens: 400,
    });

    expect(capturedBody).not.toBeNull();
    const text = ((capturedBody ?? {}) as { text?: { format?: { type?: string; name?: string; strict?: boolean } } }).text;
    expect(text?.format?.type).toBe("json_schema");
    expect(text?.format?.name).toBe("BusinessPlan");
    expect(text?.format?.strict).toBe(true);
  });

  it("prefers provider-native parsed structured object when available", async () => {
    const provider = new OpenAIProvider();

    Object.defineProperty(provider as unknown as Record<string, unknown>, "client", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: {
        responses: {
          create: async () => ({
            id: "resp_native_1",
            status: "completed",
            usage: { input_tokens: 11, output_tokens: 55, total_tokens: 66 },
            output: [
              {
                parsed: { verticalId: "restaurant_food_service" },
                content: [{ text: "not-used-text" }],
              },
            ],
          }),
        },
      },
    });

    const result = await provider.invoke("financial test", {
      outputModel: "FinancialModel",
      model: "gpt-4o-mini",
      maxTokens: 3600,
    }) as {
      output: unknown;
      metadata: {
        parsingClassification?: string;
        parsingStage?: string;
        configuredMaxOutputTokens?: number;
      };
    };

    expect(result.output).toEqual({ verticalId: "restaurant_food_service" });
    expect(result.metadata.parsingClassification).toBe("native_structured_object");
    expect(result.metadata.parsingStage).toBe("provider_native_parsed");
    expect(result.metadata.configuredMaxOutputTokens).toBe(3600);
  });
});
