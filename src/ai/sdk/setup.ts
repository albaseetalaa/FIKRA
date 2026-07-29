import { globalProviderManager } from "../providers/manager";
import { globalArtifactStore } from "../store/setup";
import { sdkAgentDefinitions } from "../agents/sdkDefinitions";
import { AgentRegistry } from "./agentRegistry";
import { AgentFactory } from "./agentFactory";
import { globalOutputContractRegistry } from "./outputContractRegistry";

export const globalAgentRegistry = new AgentRegistry();
for (const definition of sdkAgentDefinitions) {
  globalAgentRegistry.register(definition);
}

const dependencyValidation = globalAgentRegistry.validateDependencies();
if (!dependencyValidation.ok) {
  throw new Error(`Agent registry dependency validation failed: ${dependencyValidation.issues.join("; ")}`);
}

const contractMap = new Map(globalOutputContractRegistry.list().map((contract) => [contract.outputType, contract]));

const contractValidation = globalAgentRegistry.validateMissingContracts((outputType) => contractMap.has(outputType));
if (!contractValidation.ok) {
  throw new Error(`Agent registry contract validation failed: ${contractValidation.issues.join("; ")}`);
}

export const globalAgentFactory = new AgentFactory(
  {
    providerManager: globalProviderManager,
    artifactStore: globalArtifactStore,
  },
  contractMap,
);

globalAgentFactory.validateAtStartup(globalAgentRegistry.listEnabled());
