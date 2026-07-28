import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../sdk/agentRegistry";
import type { AgentDefinition } from "../sdk/types";
import type { AgentID } from "../types/agents";
import type { OutputModelName } from "../types/outputs";

function makeDefinition(input: {
  id: AgentID;
  output: OutputModelName;
  dependencies?: AgentID[];
  optionalDependencies?: AgentID[];
  enabled?: boolean;
  capabilities?: AgentDefinition["requiredCapabilities"];
}): AgentDefinition {
  return {
    id: input.id,
    version: "1.0.0",
    displayName: input.id,
    description: "test",
    category: "strategy",
    supportedVerticals: ["any"],
    requiredCapabilities: input.capabilities ?? [],
    requiredProjectContextFields: ["businessName"],
    inputArtifactTypes: [],
    outputArtifactType: input.output,
    promptBuilder: () => "prompt",
    providerSchema: () => null,
    structuralValidator: () => ({ success: true, value: {} }),
    semanticValidator: () => [],
    tokenBudget: { initialOutputTokens: 200, repairOutputTokens: 300, maxOutputTokens: 400 },
    retryPolicy: { maxProviderCalls: 2, maxRepairAttempts: 1, transportRetriesPerCall: 1 },
    repairPolicy: {
      enabled: true,
      buildRepairPrompt: ({ originalPrompt }) => originalPrompt,
    },
    timeoutPolicy: { timeoutMs: 1000 },
    persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
    dependencies: input.dependencies ?? [],
    optionalDependencies: input.optionalDependencies ?? [],
    enabled: input.enabled ?? true,
  };
}

describe("AgentRegistry", () => {
  it("rejects duplicate registrations", () => {
    const registry = new AgentRegistry();
    const item = makeDefinition({ id: "business_strategist", output: "BusinessPlan" });
    registry.register(item);
    expect(() => registry.register(item)).toThrow("Duplicate agent id");
  });

  it("validates missing dependencies and cycles", () => {
    const registry = new AgentRegistry();
    registry.registerMany([
      makeDefinition({ id: "business_strategist", output: "BusinessPlan", dependencies: ["market_research"] }),
      makeDefinition({ id: "market_research", output: "MarketResearchReport", dependencies: ["financial_analyst"] }),
      makeDefinition({ id: "financial_analyst", output: "FinancialModel", dependencies: ["business_strategist"] }),
    ]);

    const result = registry.validateDependencies();
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.includes("Circular dependency"))).toBe(true);
  });

  it("reports missing dependency when dependency is not registered", () => {
    const registry = new AgentRegistry();
    registry.register(makeDefinition({ id: "market_research", output: "MarketResearchReport", dependencies: ["business_strategist"] }));
    const result = registry.validateDependencies();
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("Missing dependency 'business_strategist' for 'market_research'");
  });

  it("accepts missing optional dependencies", () => {
    const registry = new AgentRegistry();
    registry.register(makeDefinition({
      id: "business_strategist",
      output: "BusinessPlan",
      optionalDependencies: ["market_research"],
      dependencies: [],
    }));

    const result = registry.validateDependencies();
    expect(result.ok).toBe(true);
  });

  it("filters enabled agents and discovers capabilities", () => {
    const registry = new AgentRegistry();
    registry.registerMany([
      makeDefinition({
        id: "business_strategist",
        output: "BusinessPlan",
        capabilities: ["database_read", "file_read"],
      }),
      makeDefinition({
        id: "market_research",
        output: "MarketResearchReport",
        enabled: false,
        capabilities: ["web_research", "file_read"],
      }),
    ]);

    expect(registry.listEnabled().map((item) => item.id)).toEqual(["business_strategist"]);
    expect(registry.discoverCapabilities()).toEqual(["database_read", "file_read", "web_research"]);
  });

  it("reports missing output contracts", () => {
    const registry = new AgentRegistry();
    registry.registerMany([
      makeDefinition({ id: "business_strategist", output: "BusinessPlan" }),
      makeDefinition({ id: "market_research", output: "MarketResearchReport" }),
    ]);

    const result = registry.validateMissingContracts((outputType) => outputType === "BusinessPlan");
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(["Missing output contract 'MarketResearchReport' for agent 'market_research'"]);
  });

  it("resolves agents by output type", () => {
    const registry = new AgentRegistry();
    registry.registerMany([
      makeDefinition({ id: "business_strategist", output: "BusinessPlan" }),
      makeDefinition({ id: "market_research", output: "MarketResearchReport" }),
      makeDefinition({ id: "financial_analyst", output: "FinancialModel" }),
    ]);

    expect(registry.resolveByOutputType("BusinessPlan").map((item) => item.id)).toEqual(["business_strategist"]);
    expect(registry.resolveByOutputType("FinancialModel").map((item) => item.id)).toEqual(["financial_analyst"]);
  });
});
