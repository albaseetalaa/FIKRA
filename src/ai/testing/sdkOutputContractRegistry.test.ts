import { describe, expect, it } from "vitest";
import { OutputContractRegistry, outputContracts } from "../sdk/outputContractRegistry";
import mocks from "./mocks";
import type { ProjectContext } from "../context";
import { createProjectContextFixture } from "../context";

const eggreenContext: ProjectContext = createProjectContextFixture({
  projectId: "proj_eggreen",
  businessName: "Eggreen",
  businessDescription: "Healthy breakfast restaurant",
  budgetRange: null,
  launchTimeline: "Within 3 months",
});

describe("OutputContractRegistry", () => {
  it("contains canonical contracts for core and orchestration outputs", () => {
    const registry = new OutputContractRegistry();
    expect(registry.get("BusinessPlan")).toBeDefined();
    expect(registry.get("MarketResearchReport")).toBeDefined();
    expect(registry.get("FinancialModel")).toBeDefined();
    expect(registry.get("ExecutionPlan")).toBeDefined();
    expect(registry.get("ProjectScore")).toBeDefined();
  });

  it("validates canonical fixtures for core trio", () => {
    const business = outputContracts.BusinessPlan.structuralValidator(mocks.validBusinessPlan, eggreenContext);
    const market = outputContracts.MarketResearchReport.structuralValidator(mocks.validMarketResearchReport, eggreenContext);
    const finance = outputContracts.FinancialModel.structuralValidator(mocks.validFinancialModel, eggreenContext);

    expect(business.success).toBe(true);
    expect(market.success).toBe(true);
    expect(finance.success).toBe(true);
  });

  it("keeps provider schema and prompt requirements for structured outputs", () => {
    const business = outputContracts.BusinessPlan;
    const market = outputContracts.MarketResearchReport;
    const finance = outputContracts.FinancialModel;

    expect(business.providerSchema(eggreenContext)).not.toBeNull();
    expect(market.providerSchema(eggreenContext)).not.toBeNull();
    expect(finance.providerSchema(eggreenContext)).not.toBeNull();

    expect(business.promptRequirements.length).toBeGreaterThan(0);
    expect(market.promptRequirements.length).toBeGreaterThan(0);
    expect(finance.promptRequirements.length).toBeGreaterThan(0);
  });

  it("rejects duplicate contract registration", () => {
    const registry = new OutputContractRegistry([]);
    registry.register(outputContracts.BusinessPlan);
    expect(() => registry.register(outputContracts.BusinessPlan)).toThrow("Duplicate output contract");
  });

  it("exposes required canonical fields for five milestone contracts", () => {
    const required = [
      outputContracts.BusinessPlan,
      outputContracts.MarketResearchReport,
      outputContracts.FinancialModel,
      outputContracts.ExecutionPlan,
      outputContracts.ProjectScore,
    ];

    for (const contract of required) {
      expect(contract.outputType).toBeTruthy();
      expect(contract.version).toBeTruthy();
      expect(typeof contract.providerSchema).toBe("function");
      expect(typeof contract.structuralValidator).toBe("function");
      expect(typeof contract.semanticValidator).toBe("function");
      expect(Array.isArray(contract.promptRequirements)).toBe(true);
      expect(contract.persistenceMetadata.validationStatusOnSuccess).toBe("valid");
      expect(typeof contract.persistenceMetadata.schemaVersion).toBe("number");
      expect(typeof contract.persistenceMetadata.artifactVersion).toBe("number");
      expect(contract.migrationMetadata.currentVersion).toBeTruthy();
      expect(Array.isArray(contract.migrationMetadata.previousVersions)).toBe(true);
    }
  });
});
