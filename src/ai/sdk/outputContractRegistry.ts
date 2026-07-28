import type { ProjectContext } from "../context";
import type { OutputModelName } from "../types/outputs";
import { getProviderOutputSchema } from "../providers/outputSchemas";
import { validateModel } from "../validation/validator";
import {
  validateBusinessPlanSemantics,
  validateFinancialModelSemantics,
  validateMarketResearchSemantics,
} from "../validation/semanticValidators";
import type { OutputContract } from "./types";

type RawOutputContract = Omit<OutputContract, "persistenceMetadata"> & {
  persistenceMetadata?: OutputContract["persistenceMetadata"];
};

const DEFAULT_PERSISTENCE_METADATA: OutputContract["persistenceMetadata"] = {
  validationStatusOnSuccess: "valid",
  persistInvalidArtifacts: false,
  schemaVersion: 1,
  artifactVersion: 1,
};

function toCanonicalContract(contract: RawOutputContract): OutputContract {
  return {
    ...contract,
    persistenceMetadata: contract.persistenceMetadata ?? DEFAULT_PERSISTENCE_METADATA,
  };
}

function structural(outputType: OutputModelName, raw: unknown, projectContext?: ProjectContext) {
  return validateModel(outputType, raw, { projectContext });
}

const emptySemantic = () => [] as string[];

const rawOutputContracts: Record<OutputModelName, RawOutputContract> = {
  BusinessPlan: {
    outputType: "BusinessPlan",
    version: "1.0.0",
    tsTypeName: "BusinessPlan",
    providerSchema: (ctx) => getProviderOutputSchema("BusinessPlan", ctx),
    structuralValidator: (raw, projectContext) => structural("BusinessPlan", raw, projectContext),
    semanticValidator: (raw, projectContext) => {
      const parsed = validateModel("BusinessPlan", raw, { projectContext });
      if (!parsed.success) return parsed.errors.map((item) => item.message);
      return validateBusinessPlanSemantics(parsed.value as never, projectContext);
    },
    promptRequirements: [
      "Return only JSON matching BusinessPlan schema.",
      "Authoritative fields must match ProjectContext.",
      "Milestones must be ordered and non-stale.",
    ],
    requiresStructuredOutput: true,
    allowsPassThroughStructuralValidation: false,
    requiresSemanticValidation: true,
    migrationMetadata: {
      currentVersion: "1.0.0",
      previousVersions: [],
    },
  },
  MarketResearchReport: {
    outputType: "MarketResearchReport",
    version: "1.0.0",
    tsTypeName: "MarketResearchReport",
    providerSchema: (ctx) => getProviderOutputSchema("MarketResearchReport", ctx),
    structuralValidator: (raw, projectContext) => structural("MarketResearchReport", raw, projectContext),
    semanticValidator: (raw) => {
      const parsed = validateModel("MarketResearchReport", raw);
      if (!parsed.success) return parsed.errors.map((item) => item.message);
      return validateMarketResearchSemantics(parsed.value as never);
    },
    promptRequirements: [
      "Use evidenceType and validationStatus enums exactly.",
      "Do not fabricate citations.",
      "Provide unavailableCompetitorOutcome when competitor data is unavailable.",
    ],
    requiresStructuredOutput: true,
    allowsPassThroughStructuralValidation: false,
    requiresSemanticValidation: true,
    migrationMetadata: {
      currentVersion: "1.0.0",
      previousVersions: [],
    },
  },
  FinancialModel: {
    outputType: "FinancialModel",
    version: "1.0.0",
    tsTypeName: "FinancialModel",
    providerSchema: (ctx) => getProviderOutputSchema("FinancialModel", ctx),
    structuralValidator: (raw, projectContext) => structural("FinancialModel", raw, projectContext),
    semanticValidator: (raw, projectContext) => {
      const parsed = validateModel("FinancialModel", raw, { projectContext });
      if (!parsed.success) return parsed.errors.map((item) => item.message);
      return validateFinancialModelSemantics(parsed.value as never, projectContext);
    },
    promptRequirements: [
      "Formula fields must reference inputValues names.",
      "Use exactly conservative/expected/optimistic scenarios.",
      "Financial values must include currency/period/assumptions/confidence.",
    ],
    requiresStructuredOutput: true,
    allowsPassThroughStructuralValidation: false,
    requiresSemanticValidation: true,
    migrationMetadata: {
      currentVersion: "1.0.0",
      previousVersions: [],
    },
  },
  CompetitorAnalysis: {
    outputType: "CompetitorAnalysis",
    version: "1.0.0",
    tsTypeName: "CompetitorAnalysis",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("CompetitorAnalysis", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: [],
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  FinancialReport: {
    outputType: "FinancialReport",
    version: "1.0.0",
    tsTypeName: "FinancialReport",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("FinancialReport", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: [],
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  ProjectScore: {
    outputType: "ProjectScore",
    version: "1.0.0",
    tsTypeName: "ProjectScore",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("ProjectScore", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: ["Deterministic weighted-score structure."],
    requiresStructuredOutput: false,
    allowsPassThroughStructuralValidation: false,
    requiresSemanticValidation: false,
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  ExecutionPlan: {
    outputType: "ExecutionPlan",
    version: "1.0.0",
    tsTypeName: "ExecutionPlan",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("ExecutionPlan", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: ["Workflow-level execution contract."],
    requiresStructuredOutput: false,
    allowsPassThroughStructuralValidation: false,
    requiresSemanticValidation: false,
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  BrandStrategy: {
    outputType: "BrandStrategy",
    version: "1.0.0",
    tsTypeName: "BrandStrategy",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("BrandStrategy", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: [],
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  LogoConcept: {
    outputType: "LogoConcept",
    version: "1.0.0",
    tsTypeName: "LogoConcept",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("LogoConcept", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: [],
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  VisualIdentity: {
    outputType: "VisualIdentity",
    version: "1.0.0",
    tsTypeName: "VisualIdentity",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("VisualIdentity", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: [],
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  WebsiteStructure: {
    outputType: "WebsiteStructure",
    version: "1.0.0",
    tsTypeName: "WebsiteStructure",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("WebsiteStructure", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: [],
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  MarketingPlan: {
    outputType: "MarketingPlan",
    version: "1.0.0",
    tsTypeName: "MarketingPlan",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("MarketingPlan", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: [],
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  OperationsPlan: {
    outputType: "OperationsPlan",
    version: "1.0.0",
    tsTypeName: "OperationsPlan",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("OperationsPlan", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: [],
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  PitchDeck: {
    outputType: "PitchDeck",
    version: "1.0.0",
    tsTypeName: "PitchDeck",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("PitchDeck", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: [],
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  GrowthRoadmap: {
    outputType: "GrowthRoadmap",
    version: "1.0.0",
    tsTypeName: "GrowthRoadmap",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("GrowthRoadmap", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: [],
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
  ProjectSummary: {
    outputType: "ProjectSummary",
    version: "1.0.0",
    tsTypeName: "ProjectSummary",
    providerSchema: () => null,
    structuralValidator: (raw, projectContext) => structural("ProjectSummary", raw, projectContext),
    semanticValidator: emptySemantic,
    promptRequirements: [],
    migrationMetadata: { currentVersion: "1.0.0", previousVersions: [] },
  },
};

export const outputContracts: Record<OutputModelName, OutputContract> = Object.fromEntries(
  Object.entries(rawOutputContracts).map(([outputType, contract]) => [outputType, toCanonicalContract(contract)]),
) as Record<OutputModelName, OutputContract>;

export class OutputContractRegistry {
  private readonly contracts = new Map<OutputModelName, OutputContract>();

  constructor(seed: RawOutputContract[] = Object.values(outputContracts)) {
    for (const contract of seed) {
      this.register(contract);
    }
  }

  register(contract: RawOutputContract) {
    const canonical = toCanonicalContract(contract);
    if (this.contracts.has(canonical.outputType)) {
      throw new Error(`Duplicate output contract '${canonical.outputType}'`);
    }
    this.contracts.set(canonical.outputType, canonical);
  }

  get(outputType: OutputModelName): OutputContract | undefined {
    return this.contracts.get(outputType);
  }

  list(): OutputContract[] {
    return Array.from(this.contracts.values());
  }
}

export const globalOutputContractRegistry = new OutputContractRegistry();
