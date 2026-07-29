import type { OutputContract } from "../types";

export const outputContractTemplate: OutputContract = {
  outputType: "ProjectSummary",
  version: "1.0.0",
  tsTypeName: "ProjectSummary",
  providerSchema: () => ({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    properties: {
      __notConfigured: { const: "IMPLEMENT_OUTPUT_CONTRACT" },
    },
    required: ["__notConfigured"],
  }),
  structuralValidator: () => ({
    success: false,
    errors: [
      {
        path: [],
        code: "custom",
        message: "Output contract template is not configured. Implement structural validation before enabling this agent.",
      },
    ],
  }),
  semanticValidator: () => [
    "Output contract template is not configured. Implement semantic validation before enabling this agent.",
  ],
  promptRequirements: [
    "Return one JSON object only.",
    "Do not add fields outside the schema.",
  ],
  requiresStructuredOutput: true,
  allowsPassThroughStructuralValidation: false,
  requiresSemanticValidation: true,
  persistenceMetadata: {
    validationStatusOnSuccess: "valid",
    persistInvalidArtifacts: false,
    schemaVersion: 1,
    artifactVersion: 1,
  },
  migrationMetadata: {
    currentVersion: "1.0.0",
    previousVersions: [],
  },
};
