import type { AgentCapability } from "./types";

export class CapabilityDeniedError extends Error {
  readonly code = "CAPABILITY_DENIED" as const;
  readonly required: AgentCapability[];
  readonly declared: AgentCapability[];
  readonly missing: AgentCapability[];

  constructor(params: {
    required: AgentCapability[];
    declared: AgentCapability[];
  }) {
    const missing = params.required.filter((capability) => !params.declared.includes(capability));
    super(`Undeclared capabilities: ${missing.join(", ") || "none"}`);
    this.name = "CapabilityDeniedError";
    this.required = params.required;
    this.declared = params.declared;
    this.missing = missing;
  }
}

export function assertCapabilityDeclared(declared: AgentCapability[], requested: AgentCapability) {
  if (!declared.includes(requested)) {
    throw new CapabilityDeniedError({
      required: [requested],
      declared,
    });
  }
}

export function assertCapabilitiesDeclared(declared: AgentCapability[], requested: AgentCapability[]) {
  const missing = requested.filter((capability) => !declared.includes(capability));
  if (missing.length > 0) {
    throw new CapabilityDeniedError({
      required: requested,
      declared,
    });
  }
}

export function buildExecutionRequiredCapabilities(input: {
  declaredCapabilities: AgentCapability[];
  requiresProviderCall: boolean;
}) {
  const required = [...input.declaredCapabilities];
  if (input.requiresProviderCall && !required.includes("external_api")) {
    required.push("external_api");
  }
  return required;
}
