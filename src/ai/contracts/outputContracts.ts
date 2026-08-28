export const SOURCE_CLASSIFICATIONS = [
  "user_provided",
  "verified_source",
  "calculated_estimate",
  "model_assumption",
  "requires_validation",
  "unavailable",
] as const;

export const EVIDENCE_TYPES = SOURCE_CLASSIFICATIONS;

export const EVIDENCE_VALIDATION_STATUSES = [
  "verified",
  "partially_verified",
  "unverified",
  "requires_external_research",
  "unavailable",
] as const;

export const COMPETITOR_DATA_STATUSES = ["verified", "partially_verified", "unavailable"] as const;

export const MARKET_CLAIM_REQUIRED_FIELDS = [
  "claimId",
  "claim",
  "evidenceType",
  "source",
  "sourceTitle",
  "sourceDate",
  "methodology",
  "geography",
  "timePeriod",
  "confidence",
  "validationStatus",
  "generatedAt",
] as const;

export const UNAVAILABLE_COMPETITOR_OUTCOME_REQUIRED_FIELDS = [
  "competitorDataStatus",
  "competitorCategoriesToInvestigate",
  "requiredResearchActions",
  "suggestedSearchQueries",
  "comparisonCriteria",
] as const;

export const VERIFIED_COMPETITOR_REQUIRED_FIELDS = [
  "name",
  "geography",
  "category",
  "targetCustomer",
  "offering",
  "pricePosition",
  "whyItCompetes",
  "strengths",
  "weaknesses",
  "evidence",
  "validationStatus",
] as const;

export const COMPETITOR_EVIDENCE_REQUIRED_FIELDS = [
  "sourceType",
  "sourceTitle",
  "validationStatus",
] as const;

// Single source of truth for BusinessPlan's required top-level fields —
// referenced by the actual provider JSON schema (outputSchemas.ts) and by
// the live prompt (agentPromptBuilder.ts), so the two can never manually
// drift apart the way they previously did (modelProvider/modelName were
// schema-required but silently absent from the prompt's own field list).
export const BUSINESS_PLAN_REQUIRED_FIELDS = [
  "businessName",
  "country",
  "city",
  "currency",
  "businessStage",
  "executiveSummary",
  "problem",
  "solution",
  "valueProposition",
  "targetMarket",
  "customerSegments",
  "businessVertical",
  "primaryRevenueModel",
  "secondaryRevenueModels",
  "operatingModel",
  "salesChannels",
  "revenueComponents",
  "competitiveAdvantage",
  "objectives",
  "milestones",
  "risks",
  "assumptions",
  "missingInputs",
  "confidenceLevel",
  "evidenceSummary",
  "generatedAt",
  "contextVersion",
  "verticalTemplateVersion",
  "modelProvider",
  "modelName",
  "sourceClassification",
] as const;

// The subset of BUSINESS_PLAN_REQUIRED_FIELDS that FIKRA itself supplies
// deterministically after generation (see lifecycle.ts's
// withSystemOwnedProvenance) rather than asking the model to produce a
// correct value for. The model is never a trustworthy source for its own
// provider/model identity, and verticalTemplateVersion must reflect the
// system's own vertical-template registry, not a model guess — so these are
// intentionally excluded from the "here's what you must supply" prompt
// instructions built from BUSINESS_PLAN_REQUIRED_FIELDS, even though the
// provider JSON schema still requires the keys to exist structurally.
export const BUSINESS_PLAN_SYSTEM_OWNED_FIELDS = [
  "modelProvider",
  "modelName",
  "verticalTemplateVersion",
] as const;

export const MARKET_RESEARCH_REQUIRED_FIELDS = [
  "summary",
  "targetCustomers",
  "marketSizeEstimate",
  "trends",
  "claims",
  "competitorDataStatus",
  "competitors",
  "unavailableCompetitorOutcome",
  "assumptions",
  "missingInputs",
  "confidenceLevel",
  "evidenceSummary",
  "generatedAt",
  "contextVersion",
  "verticalTemplateVersion",
  "modelProvider",
  "modelName",
  "sourceClassification",
] as const;
