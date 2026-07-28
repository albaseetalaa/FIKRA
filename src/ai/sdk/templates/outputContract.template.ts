import type { OutputContract } from "../types";

export const outputContractTemplate: OutputContract = {
  outputType: "ProjectSummary",
  version: "1.0.0",
  tsTypeName: "ProjectSummary",
  providerSchema: () => null,
  structuralValidator: (raw) => ({ success: true, value: raw }),
  semanticValidator: () => [],
  promptRequirements: [
    "Return one JSON object only.",
    "Do not add fields outside the schema.",
  ],
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
