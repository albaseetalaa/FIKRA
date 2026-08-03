// Canonical, stable machine values for the onboarding wizard's budget and
// launch-timeline choices. The wizard stores and submits these ids (never
// the display label), so a label can be reworded freely without ever
// changing what reaches the API, the RPC, or ProjectContext. Ids intentionally
// carry no currency name or currency code — currency is resolved exclusively
// from the project's explicit currency field (see currencyResolver.ts).

import { defaultCurrencyForCountry } from "./currencyResolver";

export interface BudgetRangeOption {
  id: string;
  label: string;
  min?: number;
  max?: number;
}

export const BUDGET_RANGE_OPTIONS: readonly BudgetRangeOption[] = [
  { id: "under_5000", label: "Under 5,000", max: 5000 },
  { id: "5000_15000", label: "5,000 - 15,000", min: 5000, max: 15000 },
  { id: "15000_50000", label: "15,000 - 50,000", min: 15000, max: 50000 },
  { id: "50000_plus", label: "50,000+", min: 50000 },
  { id: "not_sure", label: "Not sure yet" },
];

export type LaunchTimelineMode = "fixed" | "asap" | "flexible";

export interface LaunchTimelineOption {
  id: string;
  label: string;
  mode: LaunchTimelineMode;
  // A concrete day count only exists for "fixed" options. "asap" and
  // "flexible" are real, valid choices with no fixed day count — they
  // must never be silently converted into an invented number (previously
  // 14 and 365 respectively, which had no cited product/business source
  // and risked presenting fabricated precision to AI agents as if it were
  // user-provided fact).
  days: number | null;
}

export const LAUNCH_TIMELINE_OPTIONS: readonly LaunchTimelineOption[] = [
  { id: "asap", label: "As soon as possible", mode: "asap", days: null },
  { id: "within_30_days", label: "Within 30 days", mode: "fixed", days: 30 },
  { id: "within_3_months", label: "Within 3 months", mode: "fixed", days: 90 },
  { id: "within_6_months", label: "Within 6 months", mode: "fixed", days: 180 },
  { id: "flexible", label: "Flexible", mode: "flexible", days: null },
];

export function findBudgetRangeOption(id?: string | null): BudgetRangeOption | undefined {
  if (!id) return undefined;
  return BUDGET_RANGE_OPTIONS.find((option) => option.id === id);
}

export function findLaunchTimelineOption(id?: string | null): LaunchTimelineOption | undefined {
  if (!id) return undefined;
  return LAUNCH_TIMELINE_OPTIONS.find((option) => option.id === id);
}

export function budgetRangeLabel(id?: string | null): string {
  return findBudgetRangeOption(id)?.label ?? (id ?? "—");
}

export function launchTimelineLabel(id?: string | null): string {
  return findLaunchTimelineOption(id)?.label ?? (id ?? "—");
}

/**
 * Suggests a default currency for a given country without ever overriding
 * an explicit user selection. Onboarding uses this only to pre-fill the
 * currency field; the submitted value is always what actually gets sent.
 */
export function suggestCurrencyForCountry(country?: string | null): string | null {
  return defaultCurrencyForCountry(country);
}
