import type { AgentDefinition } from "../types";
import type { AgentID } from "../../types/agents";
import type { OutputModelName } from "../../types/outputs";

export function createAgentDefinitionTemplate(input: {
  id: AgentID;
  outputArtifactType: OutputModelName;
  displayName: string;
  category: AgentDefinition["category"];
  dependencies?: AgentID[];
}): AgentDefinition {
  return {
    id: input.id,
    version: "1.0.0",
    displayName: input.displayName,
    description: "Describe the agent responsibilities.",
    category: input.category,
    supportedVerticals: ["any"],
    requiredCapabilities: ["external_api"],
    requiredProjectContextFields: ["businessName", "businessDescription", "country", "businessVertical"],
    inputArtifactTypes: [],
    outputArtifactType: input.outputArtifactType,
    promptBuilder: () => "Return a strict JSON object only.",
    providerSchema: () => ({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      properties: {
        __notConfigured: { const: "IMPLEMENT_AGENT_OUTPUT_SCHEMA" },
      },
      required: ["__notConfigured"],
    }),
    structuralValidator: () => ({
      success: false,
      errors: [
        {
          path: [],
          code: "custom",
          message: "Agent template is not configured. Implement structural validation before enabling this agent.",
        },
      ],
    }),
    semanticValidator: () => [
      "Agent template is not configured. Implement semantic validation before enabling this agent.",
    ],
    tokenBudget: {
      initialOutputTokens: 1500,
      repairOutputTokens: 2100,
      maxOutputTokens: 2600,
    },
    retryPolicy: {
      maxProviderCalls: 3,
      maxRepairAttempts: 2,
      transportRetriesPerCall: 2,
    },
    repairPolicy: {
      enabled: true,
      buildRepairPrompt: ({ originalPrompt, issues }) => [originalPrompt, ...issues].join("\n"),
    },
    timeoutPolicy: {
      timeoutMs: 60000,
    },
    persistencePolicy: {
      persistInvalidAttempts: true,
      persistValidArtifactsOnly: true,
    },
    dependencies: input.dependencies ?? [],
    optionalDependencies: [],
    evaluationFixtures: {
      deterministicSuiteNames: ["new-agent-deterministic-suite"],
    },
    planningTags: ["template"],
    selectableByDefault: false,
    enabled: false,
  };
}
