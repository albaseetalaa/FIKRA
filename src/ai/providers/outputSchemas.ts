import {
  COMPETITOR_DATA_STATUSES,
  COMPETITOR_EVIDENCE_REQUIRED_FIELDS,
  EVIDENCE_TYPES,
  EVIDENCE_VALIDATION_STATUSES,
  MARKET_CLAIM_REQUIRED_FIELDS,
  MARKET_RESEARCH_REQUIRED_FIELDS,
  SOURCE_CLASSIFICATIONS,
  UNAVAILABLE_COMPETITOR_OUTCOME_REQUIRED_FIELDS,
  VERIFIED_COMPETITOR_REQUIRED_FIELDS,
} from "../contracts/outputContracts";
import type { OutputModelName } from "../types/outputs";
import type { ProjectContext } from "../context";

type JsonSchema = Record<string, unknown>;

const businessPlanSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessName",
    "country",
    "city",
    "currency",
    "businessStage",
    "executiveSummary",
    "problem",
    "solution",
    "valueProposition",
    "targetMarket",
    "customerSegments",
    "businessVertical",
    "primaryRevenueModel",
    "secondaryRevenueModels",
    "operatingModel",
    "salesChannels",
    "revenueComponents",
    "competitiveAdvantage",
    "objectives",
    "milestones",
    "risks",
    "assumptions",
    "missingInputs",
    "confidenceLevel",
    "evidenceSummary",
    "generatedAt",
    "contextVersion",
    "verticalTemplateVersion",
    "modelProvider",
    "modelName",
    "sourceClassification",
  ],
  properties: {
    businessName: { type: "string" },
    country: { type: "string" },
    city: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    businessStage: { type: "string" },
    executiveSummary: { type: "string" },
    problem: { type: "string" },
    solution: { type: "string" },
    valueProposition: { type: "string" },
    targetMarket: { type: "string" },
    customerSegments: { type: "array", items: { type: "string" }, maxItems: 20 },
    businessVertical: { type: "string" },
    primaryRevenueModel: { type: "string" },
    secondaryRevenueModels: { type: "array", items: { type: "string" }, maxItems: 10 },
    operatingModel: { type: "string" },
    salesChannels: { type: "array", items: { type: "string" }, maxItems: 15 },
    revenueComponents: { type: "array", items: { type: "string" }, maxItems: 20 },
    competitiveAdvantage: { type: "string" },
    objectives: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "statement", "metric", "targetValue", "timeHorizon"],
        properties: {
          id: { type: "string" },
          statement: { type: "string" },
          metric: { type: "string" },
          targetValue: { type: "string" },
          timeHorizon: { type: "string" },
        },
      },
    },
    milestones: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "description", "targetDate", "dateSource", "dependencies", "confidence", "assumptions"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          targetDate: { type: "string" },
          dateSource: { type: "string", enum: ["user_provided", "calculated_from_timeline", "model_assumption"] },
          dependencies: { type: "array", items: { type: "string" }, maxItems: 20 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          assumptions: { type: "array", items: { type: "string" }, maxItems: 20 },
        },
      },
    },
    risks: { type: "array", items: { type: "string" }, maxItems: 20 },
    assumptions: { type: "array", items: { type: "string" }, maxItems: 20 },
    missingInputs: { type: "array", items: { type: "string" }, maxItems: 20 },
    confidenceLevel: { type: "number", minimum: 0, maximum: 1 },
    evidenceSummary: { type: "array", items: { type: "string" }, maxItems: 20 },
    generatedAt: { type: "string" },
    contextVersion: { type: "string" },
    verticalTemplateVersion: { type: "string" },
    modelProvider: { type: ["string", "null"] },
    modelName: { type: ["string", "null"] },
    sourceClassification: {
      type: "string",
      enum: [...SOURCE_CLASSIFICATIONS],
    },
  },
};

const marketResearchSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [...MARKET_RESEARCH_REQUIRED_FIELDS],
  properties: {
    summary: { type: "string" },
    targetCustomers: { type: "array", items: { type: "string" }, maxItems: 20 },
    marketSizeEstimate: { type: "string" },
    trends: { type: "array", items: { type: "string" }, maxItems: 20 },
    claims: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: [...MARKET_CLAIM_REQUIRED_FIELDS],
        properties: {
          claimId: { type: "string" },
          claim: { type: "string" },
          evidenceType: {
            type: "string",
            enum: [...EVIDENCE_TYPES],
          },
          source: { type: ["string", "null"] },
          sourceTitle: { type: ["string", "null"] },
          sourceDate: { type: ["string", "null"] },
          methodology: { type: "string" },
          geography: { type: "string" },
          timePeriod: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          validationStatus: {
            type: "string",
            enum: [...EVIDENCE_VALIDATION_STATUSES],
          },
          generatedAt: { type: "string" },
        },
      },
    },
    competitorDataStatus: { type: "string", enum: [...COMPETITOR_DATA_STATUSES] },
    competitors: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: [...VERIFIED_COMPETITOR_REQUIRED_FIELDS],
        properties: {
          name: { type: "string" },
          geography: { type: "string" },
          category: { type: "string" },
          targetCustomer: { type: "string" },
          offering: { type: "string" },
          pricePosition: { type: "string" },
          whyItCompetes: { type: "string" },
          strengths: { type: "array", items: { type: "string" }, maxItems: 20 },
          weaknesses: { type: "array", items: { type: "string" }, maxItems: 20 },
          evidence: {
            type: "object",
            additionalProperties: false,
            required: [...COMPETITOR_EVIDENCE_REQUIRED_FIELDS],
            properties: {
              sourceType: { type: "string", enum: [...EVIDENCE_TYPES] },
              sourceTitle: { type: ["string", "null"] },
              validationStatus: {
                type: "string",
                enum: [...EVIDENCE_VALIDATION_STATUSES],
              },
            },
          },
          validationStatus: {
            type: "string",
            enum: [...EVIDENCE_VALIDATION_STATUSES],
          },
        },
      },
    },
    unavailableCompetitorOutcome: {
      type: ["object", "null"],
      additionalProperties: false,
      required: [...UNAVAILABLE_COMPETITOR_OUTCOME_REQUIRED_FIELDS],
      properties: {
        competitorDataStatus: { type: "string", enum: ["unavailable"] },
        competitorCategoriesToInvestigate: { type: "array", items: { type: "string" }, maxItems: 20 },
        requiredResearchActions: { type: "array", items: { type: "string" }, maxItems: 20 },
        suggestedSearchQueries: { type: "array", items: { type: "string" }, maxItems: 20 },
        comparisonCriteria: { type: "array", items: { type: "string" }, maxItems: 20 },
      },
    },
    assumptions: { type: "array", items: { type: "string" }, maxItems: 20 },
    missingInputs: { type: "array", items: { type: "string" }, maxItems: 20 },
    confidenceLevel: { type: "number", minimum: 0, maximum: 1 },
    evidenceSummary: { type: "array", items: { type: "string" }, maxItems: 20 },
    generatedAt: { type: "string" },
    contextVersion: { type: "string" },
    verticalTemplateVersion: { type: "string" },
    modelProvider: { type: ["string", "null"] },
    modelName: { type: ["string", "null"] },
    sourceClassification: {
      type: "string",
      enum: [...SOURCE_CLASSIFICATIONS],
    },
  },
};

const monetaryValueSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["amount", "currency", "period", "estimateStatus", "sourceType", "confidence", "assumptions"],
  properties: {
    amount: { type: "number" },
    currency: { type: "string" },
    period: { type: "string", enum: ["one_time", "monthly", "annual"] },
    estimateStatus: { type: "string", enum: ["estimated", "user_provided", "calculated"] },
    sourceType: { type: "string", enum: [...EVIDENCE_TYPES] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    assumptions: { type: "array", items: { type: "string" }, maxItems: 20 },
  },
};

const financialLineItemSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "category", "value", "formula", "inputValues", "sourceType"],
  properties: {
    id: { type: "string" },
    category: { type: "string" },
    value: monetaryValueSchema,
    formula: { type: "string" },
    inputValues: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "value"],
        properties: {
          name: { type: "string" },
          value: { type: "number" },
        },
      },
    },
    sourceType: { type: "string", enum: [...EVIDENCE_TYPES] },
  },
};

const financialScenarioSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "scenario",
    "monthlyRevenue",
    "monthlyExpenses",
    "grossProfit",
    "netProfit",
    "estimatedCustomers",
    "assumptions",
    "confidence",
  ],
  properties: {
    scenario: { type: "string", enum: ["conservative", "expected", "optimistic"] },
    monthlyRevenue: monetaryValueSchema,
    monthlyExpenses: monetaryValueSchema,
    grossProfit: monetaryValueSchema,
    netProfit: monetaryValueSchema,
    estimatedCustomers: { type: "number" },
    assumptions: { type: "array", items: { type: "string" }, maxItems: 20 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

const financialModelSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "verticalId",
    "revenueModelType",
    "revenueChannels",
    "startupCosts",
    "operatingCosts",
    "revenueDrivers",
    "costCategories",
    "financialKPIs",
    "pricingRecommendation",
    "financialForecast",
    "breakEvenAnalysis",
    "fundingRecommendation",
    "assumptions",
    "missingInputs",
    "confidenceLevel",
    "evidenceSummary",
    "generatedAt",
    "contextVersion",
    "verticalTemplateVersion",
    "modelProvider",
    "modelName",
    "sourceClassification",
  ],
  properties: {
    verticalId: { type: "string" },
    revenueModelType: { type: "string" },
    revenueChannels: { type: "array", items: { type: "string" }, maxItems: 10 },
    startupCosts: { type: "array", items: financialLineItemSchema, maxItems: 15 },
    operatingCosts: { type: "array", items: financialLineItemSchema, maxItems: 20 },
    revenueDrivers: { type: "array", items: { type: "string" }, maxItems: 20 },
    costCategories: { type: "array", items: { type: "string" }, maxItems: 20 },
    financialKPIs: { type: "array", items: { type: "string" }, maxItems: 20 },
    pricingRecommendation: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tier", "recommendedPrice", "reasoning", "targetCustomer"],
        properties: {
          tier: { type: "string" },
          recommendedPrice: monetaryValueSchema,
          reasoning: { type: "string" },
          targetCustomer: { type: "string" },
        },
      },
    },
    financialForecast: { type: "array", items: financialScenarioSchema, minItems: 3, maxItems: 3 },
    breakEvenAnalysis: {
      type: "object",
      additionalProperties: false,
      required: ["estimatedMonth", "requiredMonthlyRevenue", "breakEvenDailyOrders", "formula", "notes"],
      properties: {
        estimatedMonth: { type: "number" },
        requiredMonthlyRevenue: monetaryValueSchema,
        breakEvenDailyOrders: { type: ["number", "null"] },
        formula: { type: "string" },
        notes: { type: "string" },
      },
    },
    fundingRecommendation: {
      type: "object",
      additionalProperties: false,
      required: ["type", "reasoning"],
      properties: {
        type: { type: "string", enum: ["Bootstrap", "Angel", "Seed", "VC", "Crowdfunding"] },
        reasoning: { type: "string" },
      },
    },
    assumptions: { type: "array", items: { type: "string" }, maxItems: 20 },
    missingInputs: { type: "array", items: { type: "string" }, maxItems: 20 },
    confidenceLevel: { type: "number", minimum: 0, maximum: 1 },
    evidenceSummary: { type: "array", items: { type: "string" }, maxItems: 20 },
    generatedAt: { type: "string" },
    contextVersion: { type: "string" },
    verticalTemplateVersion: { type: "string" },
    modelProvider: { type: ["string", "null"] },
    modelName: { type: ["string", "null"] },
    sourceClassification: {
      type: "string",
      enum: [...SOURCE_CLASSIFICATIONS],
    },
  },
};

const schemaByOutputType: Partial<Record<OutputModelName, JsonSchema>> = {
  BusinessPlan: businessPlanSchema,
  MarketResearchReport: marketResearchSchema,
  FinancialModel: financialModelSchema,
};

const UNSUPPORTED_KEYWORDS = ["anyOf", "oneOf", "allOf", "not", "if", "then", "else", "dependentSchemas"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function visitSchemaNode(node: unknown, path: string, errors: string[]) {
  const current = asRecord(node);
  if (!current) return;

  for (const keyword of UNSUPPORTED_KEYWORDS) {
    if (keyword in current) {
      errors.push(`${path}: unsupported JSON Schema keyword '${keyword}' for provider strict structured output.`);
    }
  }

  const typeValue = current.type;
  if (Array.isArray(typeValue)) {
    const normalized = typeValue.filter((value) => typeof value === "string") as string[];
    const nonNull = normalized.filter((value) => value !== "null");
    if (!(normalized.includes("null") && nonNull.length === 1 && normalized.length === 2)) {
      errors.push(`${path}: only nullable unions like ['x','null'] are supported.`);
    }
  }

  if (Array.isArray(current.enum) && current.enum.length === 0) {
    errors.push(`${path}: enum must not be empty.`);
  }

  const isObjectType = typeValue === "object" || (Array.isArray(typeValue) && typeValue.includes("object"));
  if (isObjectType) {
    const propertiesRecord = asRecord(current.properties);
    if (propertiesRecord) {
      const propertyKeys = Object.keys(propertiesRecord);
      const required = Array.isArray(current.required) ? (current.required.filter((value) => typeof value === "string") as string[]) : [];

      const missingRequired = propertyKeys.filter((key) => !required.includes(key));
      const extraRequired = required.filter((key) => !propertyKeys.includes(key));

      if (missingRequired.length > 0) {
        errors.push(`${path}: required is missing property keys: ${missingRequired.join(", ")}.`);
      }
      if (extraRequired.length > 0) {
        errors.push(`${path}: required references unknown property keys: ${extraRequired.join(", ")}.`);
      }
      if (current.additionalProperties !== false) {
        errors.push(`${path}: additionalProperties must be false for strict object contracts.`);
      }

      for (const [key, value] of Object.entries(propertiesRecord)) {
        visitSchemaNode(value, `${path}.properties.${key}`, errors);
      }
    }
  }

  const isArrayType = typeValue === "array";
  if (isArrayType) {
    if (!("items" in current)) {
      errors.push(`${path}: array schema must define items.`);
    } else {
      visitSchemaNode(current.items, `${path}.items`, errors);
    }
    if (typeof current.maxItems !== "number" || !Number.isFinite(current.maxItems) || current.maxItems <= 0) {
      errors.push(`${path}: array schema must define finite positive maxItems for strict output budgets.`);
    }
  }
}

export function validateProviderStrictSchemaCompatibility(schema: JsonSchema) {
  const errors: string[] = [];
  visitSchemaNode(schema, "$", errors);
  return {
    ok: errors.length === 0,
    errors,
  };
}

function cloneSchema(schema: JsonSchema): JsonSchema {
  return JSON.parse(JSON.stringify(schema)) as JsonSchema;
}

function applyContextConstraints(schema: JsonSchema, outputModel: OutputModelName, projectContext?: ProjectContext) {
  if (!projectContext) return schema;

  const constrained = cloneSchema(schema);
  const properties = asRecord(constrained.properties);
  if (!properties) return constrained;

  if (outputModel === "BusinessPlan") {
    const restrictEnum = (key: string, value: string | null) => {
      const property = asRecord(properties[key]);
      if (!property || value == null) return;
      property.type = "string";
      property.enum = [value];
    };

    restrictEnum("businessName", projectContext.businessName);
    restrictEnum("country", projectContext.country);
    restrictEnum("city", projectContext.city);
    restrictEnum("currency", projectContext.currency);
    restrictEnum("businessVertical", projectContext.businessVertical);
    restrictEnum("primaryRevenueModel", projectContext.primaryRevenueModel);
    restrictEnum("businessStage", projectContext.businessStage);

    const salesChannels = asRecord(properties.salesChannels);
    if (salesChannels) {
      salesChannels.items = {
        type: "string",
        enum: [...projectContext.salesChannels],
      };
      salesChannels.minItems = Math.min(projectContext.salesChannels.length, 1);
    }
  }

  if (outputModel === "FinancialModel") {
    const restrictEnum = (key: string, value: string | null) => {
      const property = asRecord(properties[key]);
      if (!property || value == null) return;
      property.type = "string";
      property.enum = [value];
    };

    restrictEnum("verticalId", projectContext.businessVertical);
    restrictEnum("revenueModelType", projectContext.primaryRevenueModel);

    const revenueChannels = asRecord(properties.revenueChannels);
    if (revenueChannels) {
      revenueChannels.items = {
        type: "string",
        enum: [...projectContext.salesChannels],
      };
      revenueChannels.minItems = Math.min(projectContext.salesChannels.length, 1);
    }
  }

  return constrained;
}

export function getProviderOutputSchema(outputModel?: OutputModelName, projectContext?: ProjectContext) {
  if (!outputModel) return null;
  const base = schemaByOutputType[outputModel] ?? null;
  if (!base) return null;
  return applyContextConstraints(base, outputModel, projectContext);
}
