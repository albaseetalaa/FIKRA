# Agent SDK and Shared Foundation

This SDK is the canonical runtime path for agent execution:

AgentRegistry -> AgentFactory -> shared lifecycle -> OutputContract validation -> artifact persistence

Adding a new agent must not require changes in orchestrator runtime code.

## Registration Example

```ts
import { globalAgentRegistry } from "./setup";
import { createAgentDefinitionTemplate } from "./templates/agentDefinition.template";

globalAgentRegistry.register(
  createAgentDefinitionTemplate({
    id: "marketing_strategist",
    outputArtifactType: "MarketingPlan",
    displayName: "Marketing Strategist",
    category: "growth",
    dependencies: ["business_strategist"],
  }),
);
```

## Output Contract Example

```ts
import { OutputContractRegistry } from "./outputContractRegistry";
import { outputContractTemplate } from "./templates/outputContract.template";

const registry = new OutputContractRegistry();
registry.register({
  ...outputContractTemplate,
  outputType: "MarketingPlan",
  tsTypeName: "MarketingPlan",
});
```

## Dependency Declaration Example

Declare dependencies in `AgentDefinition.dependencies` and optional dependencies in `AgentDefinition.optionalDependencies`.

## Capability Declaration Example

Declare only required capabilities in `AgentDefinition.requiredCapabilities`. Provider calls require `external_api`.

## New Agent Checklist

- Add agent definition using `templates/agentDefinition.template.ts`.
- Add output contract using `templates/outputContract.template.ts`.
- Add semantic validator using `templates/semanticValidator.template.ts`.
- Add deterministic fixture using `templates/deterministicFixture.template.ts`.
- Register the agent in SDK setup.
- Register the output contract in `OutputContractRegistry`.
- Add registry tests: duplicate id, dependencies, output-type resolution, disabled behavior.
- Add lifecycle tests: success, structural failure, semantic failure, repair success/exhaustion, provider failure, timeout, cancellation.
- Add orchestrator regression proving SDK path and no runtime branching changes.
- Add pause/resume and persistence/restart regression through SDK path.
