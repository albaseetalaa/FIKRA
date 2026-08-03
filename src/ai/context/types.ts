import type { LaunchTimelineMode } from "./budgetTimelineOptions";

export type ContextValidationStatus = "valid" | "requires_user_input" | "invalid";

export type BusinessStage = "idea" | "planning" | "operating" | "rebranding" | "expanding" | "unknown";

export type BusinessVertical =
  | "restaurant_food_service"
  | "ecommerce_retail"
  | "professional_services"
  | "saas_software"
  | "marketplace"
  | "subscription_service"
  | "physical_retail"
  | "manufacturing"
  | "real_estate"
  | "logistics_delivery"
  | "education_training"
  | "healthcare_wellness"
  | "generic_other"
  | "unknown";

export type RevenueModel =
  | "transaction_sales"
  | "subscription"
  | "usage_based"
  | "marketplace_commission"
  | "service_fees"
  | "advertising"
  | "licensing"
  | "rental"
  | "franchise"
  | "mixed"
  | "unknown";

export type SalesChannel =
  | "dine_in"
  | "takeaway"
  | "drive_thru"
  | "delivery"
  | "website"
  | "mobile_app"
  | "direct_sales"
  | "partner_sales"
  | "online_store"
  | "marketplaces"
  | "social_commerce"
  | "project_fees"
  | "retainers"
  | "advisory"
  | "in_store_sales"
  | "point_of_sale"
  | "wholesale_orders"
  | "b2b_contracts"
  | "broker_commissions"
  | "lease_fees"
  | "service_contracts"
  | "course_fees"
  | "consultation_fees"
  | "package_plans"
  | "unknown";

export type RevenueComponent =
  | "transaction_sales"
  | "transaction_commission"
  | "weekly_subscription"
  | "monthly_subscription"
  | "annual_subscription"
  | "usage_fee"
  | "service_fee"
  | "retainer_fee"
  | "delivery_fee"
  | "listing_fee"
  | "quality_grading_fee"
  | "add_on_products"
  | "advertising"
  | "licensing"
  | "rental_income"
  | "unknown";

export type CurrencyResolutionSource =
  | "user_selected"
  | "budget_hint"
  | "project_config"
  | "country_default"
  | "legacy_country_fallback"
  | "unresolved";

export interface BusinessVerticalClassification {
  vertical: BusinessVertical;
  confidence: number;
  evidence: string[];
  unresolvedAmbiguities: string[];
  alternativeCandidates: Array<{ vertical: BusinessVertical; confidence: number }>;
  requiresUserConfirmation: boolean;
}

export interface RevenueModelClassification {
  primaryRevenueModel: RevenueModel;
  secondaryRevenueModels: RevenueModel[];
  confidence: number;
  evidence: string[];
  salesChannels: SalesChannel[];
  revenueComponents: RevenueComponent[];
  unresolvedAmbiguities: string[];
}

export interface CurrencyResolution {
  currencyCode: string | null;
  resolutionSource: CurrencyResolutionSource;
  confidence: number;
  requiresConfirmation: boolean;
}

export interface ProjectContextInput {
  projectId: string;
  businessName?: string | null;
  businessDescription: string;
  industry?: string | null;
  businessStage?: string | null;
  country?: string | null;
  city?: string | null;
  currency?: string | null;
  targetAudience?: string | null;
  customerAgeRange?: string | null;
  customerType?: string | null;
  budgetRange?: string | null;
  budgetCurrency?: string | null;
  launchTimeline?: string | null;
  selectedGoals?: string[] | null;
  projectCreatedAt: string;
  currentDate: string;
}

export interface ProjectContext {
  projectId: string;
  businessName: string;
  businessDescription: string;
  industry: string;
  businessStage: BusinessStage;
  country: string;
  city: string | null;
  currency: string | null;
  currencySource: CurrencyResolutionSource;
  targetAudience: string[];
  customerAgeRange: string | null;
  customerType: string | null;
  budgetRange: string | null;
  budgetCurrency: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  launchTimeline: string | null;
  // "fixed" carries a concrete launchTimelineDays value; "asap" and
  // "flexible" are valid, resolved states with no day count — never
  // fabricate a number for them (see budgetTimelineOptions.ts).
  launchTimelineMode: LaunchTimelineMode | null;
  launchTimelineDays: number | null;
  selectedGoals: string[];
  currentDate: string;
  projectCreatedAt: string;
  businessVertical: BusinessVertical;
  businessVerticalConfidence: number;
  primaryRevenueModel: RevenueModel;
  secondaryRevenueModels: RevenueModel[];
  salesChannels: SalesChannel[];
  revenueComponents: RevenueComponent[];

  // Deprecated aliases kept for backward compatibility during migration.
  revenueModelType: RevenueModel;
  revenueChannels: SalesChannel[];
  businessModelCategory: string;
  contextVersion: string;
}

export interface ProjectContextNormalizationResult {
  status: ContextValidationStatus;
  context: ProjectContext;
  missingRequiredContext: string[];
  contradictions: string[];
  validationNotes: string[];
  verticalClassification: BusinessVerticalClassification;
  revenueModelClassification: RevenueModelClassification;
}

export interface VerticalTemplate {
  verticalId: BusinessVertical;
  version: string;
  applicableRevenueModels: RevenueModel[];
  allowedSecondaryRevenueModels?: RevenueModel[];
  allowedSalesChannels?: SalesChannel[];
  allowedRevenueComponents?: RevenueComponent[];
  revenueDrivers: string[];
  costCategories: string[];
  financialKPIs: string[];
  marketResearchTaxonomy: string[];
  competitorCategories: string[];
  requiredInputs: string[];
  optionalInputs: string[];
  allowedOutputPatterns: string[];
  forbiddenOutputPatterns: string[];
  defaultAssumptions: string[];
  confidenceRules: string[];
}
