import { classifyBusinessVertical } from "./businessVerticalClassifier";
import { resolveCurrency } from "./currencyResolver";
import { classifyRevenueModel } from "./revenueModelClassifier";
import { findBudgetRangeOption, findLaunchTimelineOption } from "./budgetTimelineOptions";
import type { BusinessStage, ProjectContext, ProjectContextInput, ProjectContextNormalizationResult } from "./types";
import type { Clock } from "../../lib/time/clock";
import { systemClock } from "../../lib/time/clock";

const CONTEXT_VERSION = "1.0.0";

function normalizeStage(stage?: string | null): BusinessStage {
  const value = stage?.trim().toLowerCase() ?? "";
  if (!value) return "unknown";
  if (value.includes("idea")) return "idea";
  if (value.includes("planning")) return "planning";
  if (value.includes("operating") || value.includes("already")) return "operating";
  if (value.includes("rebranding")) return "rebranding";
  if (value.includes("expanding")) return "expanding";
  return "unknown";
}

function normalizeGoals(goals?: string[] | null) {
  if (!goals) return [];
  return Array.from(new Set(goals.map((goal) => goal.trim()).filter(Boolean)));
}

function normalizeCountry(country?: string | null) {
  if (!country) return "";
  const compact = country.trim().replace(/\s+/g, " ");
  return compact
    .split(" ")
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function normalizeCity(city?: string | null): string | null {
  if (!city) return null;
  const compact = city.trim().replace(/\s+/g, " ");
  if (!compact) return null;
  return compact
    .split(" ")
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function normalizeAudience(audience?: string | null) {
  if (!audience) return [];
  return audience
    .split(/,|\//)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isValidIsoDate(value: string) {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function normalizeDate(value: string) {
  const parsed = new Date(value);
  return parsed.toISOString();
}

function detectContradictions(input: {
  stage: BusinessStage;
  launchTimeline?: string | null;
  businessDescription: string;
  vertical: string;
  primaryRevenueModel: string;
}) {
  const contradictions: string[] = [];
  if (input.vertical === "restaurant_food_service" && input.primaryRevenueModel === "subscription") {
    contradictions.push("Restaurant vertical conflicts with pure subscription revenue model.");
  }
  // Matches both the canonical timeline ids new submissions send ("asap",
  // "within_30_days") and legacy free text ("As soon as possible", "Within
  // 30 days") so this check does not silently stop firing once onboarding
  // switches to canonical ids.
  if (
    input.stage === "operating" &&
    /^asap$|^within_30_days$|as soon as possible|within 30 days/i.test(input.launchTimeline ?? "")
  ) {
    contradictions.push("Operating business stage conflicts with greenfield launch timeline.");
  }
  if (input.vertical === "saas_software" && /restaurant|kitchen|menu|dine\s?-?in|drive\s?-?thru/i.test(input.businessDescription.toLowerCase())) {
    contradictions.push("SaaS classification conflicts with food-service operating description.");
  }
  return contradictions;
}

export function normalizeProjectContext(
  input: ProjectContextInput,
  clock: Clock = systemClock,
): ProjectContextNormalizationResult {
  const businessDescription = input.businessDescription.trim();
  const industry = input.industry?.trim() ?? "";
  const country = normalizeCountry(input.country);
  const city = normalizeCity(input.city);
  const selectedGoals = normalizeGoals(input.selectedGoals);
  const stage = normalizeStage(input.businessStage);
  const validationNotes: string[] = [];

  const currentDateValid = isValidIsoDate(input.currentDate);
  const projectCreatedAtValid = isValidIsoDate(input.projectCreatedAt);
  const safeCurrentDate = currentDateValid ? normalizeDate(input.currentDate) : clock.nowISO();
  const safeProjectCreatedAt = projectCreatedAtValid ? normalizeDate(input.projectCreatedAt) : safeCurrentDate;

  if (!currentDateValid) {
    validationNotes.push("currentDate is invalid; normalization used server time fallback.");
  }
  if (!projectCreatedAtValid) {
    validationNotes.push("projectCreatedAt is invalid; normalization used currentDate fallback.");
  }

  if (new Date(safeCurrentDate).getTime() < new Date(safeProjectCreatedAt).getTime()) {
    validationNotes.push("currentDate is earlier than projectCreatedAt; this indicates stale clock input.");
  }

  const vertical = classifyBusinessVertical({
    industry,
    businessDescription,
    selectedGoals,
    customerType: input.customerType,
  });

  const revenue = classifyRevenueModel({
    businessVertical: vertical.vertical,
    businessDescription,
    selectedGoals,
  });

  const currency = resolveCurrency({
    explicitCurrency: input.currency,
    budgetCurrency: input.budgetCurrency,
    budgetRange: input.budgetRange,
    country,
  });

  const contradictions: string[] = detectContradictions({
    stage,
    launchTimeline: input.launchTimeline,
    businessDescription,
    vertical: vertical.vertical,
    primaryRevenueModel: revenue.primaryRevenueModel,
  });

  const budgetRangeValue = input.budgetRange?.trim() || null;
  const launchTimelineValue = input.launchTimeline?.trim() || null;

  const budgetOption = findBudgetRangeOption(budgetRangeValue);
  const launchTimelineOption = findLaunchTimelineOption(launchTimelineValue);

  const budgetMin = budgetOption?.min ?? null;
  const budgetMax = budgetOption?.max ?? null;
  const launchTimelineMode = launchTimelineOption?.mode ?? null;
  const launchTimelineDays = launchTimelineOption?.days ?? null;

  // A present-but-unmappable legacy value must never be silently turned
  // into fabricated numeric bounds — it is represented as unresolved and
  // surfaced here so context-policy validation can see it, rather than
  // guessed at.
  if (budgetRangeValue && !budgetOption) {
    validationNotes.push(
      `budgetRange '${budgetRangeValue}' does not match a canonical budget option; budgetMin/budgetMax are unresolved.`,
    );
  }
  if (launchTimelineValue && !launchTimelineOption) {
    validationNotes.push(
      `launchTimeline '${launchTimelineValue}' does not match a canonical timeline option; launchTimelineDays is unresolved.`,
    );
  }

  const missingRequiredContext: string[] = [];
  if (!businessDescription) missingRequiredContext.push("businessDescription");
  if (!industry) missingRequiredContext.push("industry");
  if (!country) missingRequiredContext.push("country");
  if (currency.currencyCode === null) missingRequiredContext.push("currency");
  if (!budgetRangeValue) missingRequiredContext.push("budgetRange");
  if (!launchTimelineValue) missingRequiredContext.push("launchTimeline");
  if (launchTimelineMode === null) missingRequiredContext.push("launchTimelineMode");
  if (launchTimelineMode === "fixed" && launchTimelineDays === null) missingRequiredContext.push("launchTimelineDays");

  const status = contradictions.length > 0
    ? "invalid"
    : missingRequiredContext.length > 0 || vertical.requiresUserConfirmation || currency.requiresConfirmation
      ? "requires_user_input"
      : "valid";

  const context: ProjectContext = {
    projectId: input.projectId,
    businessName: input.businessName?.trim() || "Unnamed Project",
    businessDescription,
    industry,
    businessStage: stage,
    country,
    city,
    currency: currency.currencyCode,
    currencySource: currency.resolutionSource,
    targetAudience: normalizeAudience(input.targetAudience),
    customerAgeRange: input.customerAgeRange?.trim() || null,
    customerType: input.customerType?.trim() || null,
    budgetRange: budgetRangeValue,
    budgetCurrency: input.budgetCurrency?.trim().toUpperCase() || null,
    budgetMin,
    budgetMax,
    launchTimeline: launchTimelineValue,
    launchTimelineMode,
    launchTimelineDays,
    selectedGoals,
    currentDate: safeCurrentDate,
    projectCreatedAt: safeProjectCreatedAt,
    businessVertical: vertical.vertical,
    businessVerticalConfidence: vertical.confidence,
    primaryRevenueModel: revenue.primaryRevenueModel,
    secondaryRevenueModels: revenue.secondaryRevenueModels,
    salesChannels: revenue.salesChannels,
    revenueComponents: revenue.revenueComponents,

    // Deprecated aliases kept during migration.
    revenueModelType: revenue.primaryRevenueModel,
    revenueChannels: revenue.salesChannels,
    businessModelCategory: revenue.primaryRevenueModel,
    contextVersion: CONTEXT_VERSION,
  };

  return {
    status,
    context,
    missingRequiredContext,
    contradictions,
    validationNotes: [...validationNotes, ...vertical.evidence, ...revenue.evidence],
    verticalClassification: vertical,
    revenueModelClassification: revenue,
  };
}
