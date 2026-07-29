import type { AgentFactoryBuildOptions, AgentFactoryServices, AgentLifecycleResult, ExecutableAgent, OutputContract } from "./types";
import type { AgentDefinition } from "./types";
import type { ProjectContext } from "../context";
import { normalizeProjectContext } from "../context";
import { executeAgentLifecycle } from "./lifecycle";

export class AgentFactory {
  private static readonly startupValidationContext = normalizeProjectContext({
    projectId: "startup-validation",
    businessName: "Startup Validation",
    businessDescription: "Validate contract schema readiness for enabled agents.",
    industry: "general",
    country: "Jordan",
    city: "Amman",
    currency: "JOD",
    businessStage: "planning",
    selectedGoals: ["launch"],
    projectCreatedAt: new Date(0).toISOString(),
    currentDate: new Date(0).toISOString(),
  }).context;

  constructor(
    private readonly services: AgentFactoryServices,
    private readonly outputContracts: Map<string, OutputContract>,
  ) {}

  validateAtStartup(definitions: AgentDefinition[]) {
    const issues: string[] = [];

    for (const definition of definitions) {
      const contract = this.outputContracts.get(definition.outputArtifactType);
      if (!contract) {
        issues.push(`Missing output contract '${definition.outputArtifactType}' for agent '${definition.id}'.`);
        continue;
      }
      if (!definition.promptBuilder) {
        issues.push(`Missing promptBuilder for agent '${definition.id}'.`);
      }

      if (!definition.enabled) {
        continue;
      }

      if (contract.requiresStructuredOutput && contract.providerSchema(AgentFactory.startupValidationContext) == null) {
        issues.push(`Enabled agent '${definition.id}' requires structured output but contract '${contract.outputType}' has null provider schema.`);
      }

      if (contract.allowsPassThroughStructuralValidation) {
        issues.push(`Enabled agent '${definition.id}' references contract '${contract.outputType}' with pass-through structural validation.`);
      }

      if (contract.requiresSemanticValidation && contract.promptRequirements.length === 0) {
        issues.push(`Enabled agent '${definition.id}' references contract '${contract.outputType}' without semantic validation requirements.`);
      }

      if (
        !definition.tokenBudget
        || definition.tokenBudget.initialOutputTokens <= 0
        || definition.tokenBudget.repairOutputTokens <= 0
        || definition.tokenBudget.maxOutputTokens <= 0
      ) {
        issues.push(`Enabled agent '${definition.id}' has incomplete tokenBudget policy.`);
      }

      if (
        !definition.retryPolicy
        || definition.retryPolicy.maxProviderCalls <= 0
        || definition.retryPolicy.transportRetriesPerCall <= 0
        || definition.retryPolicy.maxRepairAttempts < 0
      ) {
        issues.push(`Enabled agent '${definition.id}' has incomplete retry policy.`);
      }

      if (!definition.persistencePolicy) {
        issues.push(`Enabled agent '${definition.id}' has incomplete persistence policy.`);
      }
    }

    if (issues.length > 0) {
      throw new Error(`AgentFactory startup validation failed: ${issues.join(" ")}`);
    }
  }

  build(definition: AgentDefinition, options: AgentFactoryBuildOptions): ExecutableAgent {
    const contract = this.outputContracts.get(definition.outputArtifactType);
    if (!contract) {
      throw new Error(`Unsupported output type '${definition.outputArtifactType}' for agent '${definition.id}'.`);
    }

    return {
      definition,
      execute: async (ctx, rawInput) => {
        const effectiveContext = ctx.persistence?.artifactStore
          ? ctx
          : {
              ...ctx,
              persistence: {
                artifactStore: this.services.artifactStore,
              },
            };

        const prepared = definition.lifecycleHooks?.prepareInput
          ? definition.lifecycleHooks.prepareInput(effectiveContext, rawInput)
          : rawInput;

        const prompt = definition.promptBuilder({
          ...effectiveContext,
          upstreamArtifacts: prepared,
        });

        const lifecycle = await executeAgentLifecycle({
          definitionPrompt: prompt,
          outputContract: contract,
          executionContext: effectiveContext,
          requiredCapabilities: definition.requiredCapabilities,
          requiredProjectContextFields: definition.requiredProjectContextFields,
          supportedVerticals: definition.supportedVerticals,
          persistencePolicy: definition.persistencePolicy,
          maxTransportRetries: definition.retryPolicy.transportRetriesPerCall,
          maxRepairAttempts: definition.retryPolicy.maxRepairAttempts,
          maxProviderCalls: definition.retryPolicy.maxProviderCalls,
          getProvider: options.getProvider ?? (() => this.services.providerManager.get(options.providerId)),
          model: options.model,
          lifecycleHooks: definition.lifecycleHooks,
          temperature: effectiveContext.modelConfig?.temperature,
          timeoutMs: definition.timeoutPolicy.timeoutMs,
          buildRepairPrompt: (issues) => {
            if (!definition.repairPolicy.enabled) {
              return prompt;
            }
            return definition.repairPolicy.buildRepairPrompt({
              originalPrompt: prompt,
              issues,
              outputType: definition.outputArtifactType,
              projectContext: ctx.projectContext as ProjectContext,
            });
          },
        });

        return Object.assign(lifecycle.result, { attempts: lifecycle.attempts }) as AgentLifecycleResult;
      },
    };
  }
}
