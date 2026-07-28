import type { AgentFactoryBuildOptions, AgentFactoryServices, AgentLifecycleResult, ExecutableAgent, OutputContract } from "./types";
import type { AgentDefinition } from "./types";
import type { ProjectContext } from "../context";
import { executeAgentLifecycle } from "./lifecycle";

export class AgentFactory {
  constructor(
    private readonly services: AgentFactoryServices,
    private readonly outputContracts: Map<string, OutputContract>,
  ) {}

  validateAtStartup(definitions: AgentDefinition[]) {
    const issues: string[] = [];

    for (const definition of definitions) {
      if (!this.outputContracts.has(definition.outputArtifactType)) {
        issues.push(`Missing output contract '${definition.outputArtifactType}' for agent '${definition.id}'.`);
      }
      if (!definition.promptBuilder) {
        issues.push(`Missing promptBuilder for agent '${definition.id}'.`);
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
        const prepared = definition.lifecycleHooks?.prepareInput
          ? definition.lifecycleHooks.prepareInput(ctx, rawInput)
          : rawInput;

        const prompt = definition.promptBuilder({
          ...ctx,
          upstreamArtifacts: prepared,
        });

        const lifecycle = await executeAgentLifecycle({
          definitionPrompt: prompt,
          providerPrompt: prompt,
          outputContract: contract,
          executionContext: ctx,
          requiredCapabilities: definition.requiredCapabilities,
          persistencePolicy: definition.persistencePolicy,
          maxTransportRetries: definition.retryPolicy.transportRetriesPerCall,
          maxRepairAttempts: definition.retryPolicy.maxRepairAttempts,
          maxProviderCalls: definition.retryPolicy.maxProviderCalls,
          getProvider: options.getProvider ?? (() => this.services.providerManager.get(options.providerId)),
          model: options.model,
          temperature: ctx.modelConfig?.temperature,
          maxTokens: ctx.outputTokenBudget.initialOutputTokens,
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

        return lifecycle.result as AgentLifecycleResult;
      },
    };
  }
}
