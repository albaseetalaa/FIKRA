import type { AgentID } from "../types/agents";
import type { OutputModelName } from "../types/outputs";
import type { AgentDefinition } from "./types";

function detectCycles(definitions: AgentDefinition[]) {
  const byId = new Map<AgentID, AgentDefinition>();
  for (const definition of definitions) byId.set(definition.id, definition);

  const visiting = new Set<AgentID>();
  const visited = new Set<AgentID>();

  const walk = (id: AgentID): boolean => {
    if (visited.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);
    const deps = byId.get(id)?.dependencies ?? [];
    for (const dep of deps) {
      if (byId.has(dep) && walk(dep)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  for (const id of byId.keys()) {
    if (walk(id)) return true;
  }

  return false;
}

export class AgentRegistry {
  private readonly byId = new Map<AgentID, AgentDefinition>();

  register(definition: AgentDefinition) {
    if (this.byId.has(definition.id)) {
      throw new Error(`Duplicate agent id '${definition.id}'`);
    }
    this.byId.set(definition.id, definition);
  }

  registerMany(definitions: AgentDefinition[]) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  getById(id: AgentID): AgentDefinition | undefined {
    return this.byId.get(id);
  }

  resolveByOutputType(outputType: OutputModelName): AgentDefinition[] {
    return this.list().filter((agent) => agent.outputArtifactType === outputType);
  }

  list(): AgentDefinition[] {
    return Array.from(this.byId.values());
  }

  listEnabled(): AgentDefinition[] {
    return this.list().filter((agent) => agent.enabled);
  }

  discoverAllCapabilities(): string[] {
    return Array.from(new Set(this.list().flatMap((agent) => agent.requiredCapabilities))).sort();
  }

  discoverEnabledCapabilities(): string[] {
    return Array.from(new Set(this.listEnabled().flatMap((agent) => agent.requiredCapabilities))).sort();
  }

  discoverCapabilities(): string[] {
    // Backward-compatible alias for existing callers/tests.
    return this.discoverAllCapabilities();
  }

  getVersionMetadata() {
    return this.list().map((agent) => ({ id: agent.id, version: agent.version, enabled: agent.enabled }));
  }

  validateDependencies() {
    const issues: string[] = [];
    for (const agent of this.list()) {
      for (const dep of agent.dependencies) {
        if (!this.byId.has(dep)) {
          issues.push(`Missing dependency '${dep}' for '${agent.id}'`);
        }
      }
    }

    if (detectCycles(this.list())) {
      issues.push("Circular dependency detected in agent registry.");
    }

    return {
      ok: issues.length === 0,
      issues,
    };
  }

  validateMissingContracts(hasContract: (outputType: OutputModelName) => boolean) {
    const issues: string[] = [];
    for (const agent of this.list()) {
      if (!hasContract(agent.outputArtifactType)) {
        issues.push(`Missing output contract '${agent.outputArtifactType}' for agent '${agent.id}'`);
      }
    }

    return {
      ok: issues.length === 0,
      issues,
    };
  }
}
