import { AgentDefinition, AgentStatus } from "../types/agents";
import { OutputModelName } from "../types/outputs";
import { sdkAgentDefinitions } from "./sdkDefinitions";

export const agents: AgentDefinition[] = sdkAgentDefinitions.map((definition, index) => ({
  id: definition.id,
  name: definition.displayName,
  description: definition.description,
  responsibilities: [],
  inputSchema: { type: "object", properties: {}, required: [] },
  outputSchema: { type: "object", properties: {}, required: [] },
  outputModel: definition.outputArtifactType as OutputModelName,
  status: AgentStatus.Idle,
  priority: index + 1,
}));

export default agents;
