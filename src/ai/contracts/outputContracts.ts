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
