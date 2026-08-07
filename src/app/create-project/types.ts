export type WizardData = {
  idea: string;
  businessName?: string;
  industry?: string;
  country?: string;
  city?: string;
  stage?: string;
  audience?: string;
  ageRange?: string;
  customerType?: string;
  goals: string[];
  // Canonical ids (see budgetTimelineOptions.ts), never free text and
  // never a currency name/code — e.g. "under_5000", not "Under SAR 5,000".
  budget?: string;
  timeline?: string;
  // The project's operating/reporting currency: an explicit, required,
  // uppercase ISO-4217-style 3-letter code (e.g. "JOD"). A country
  // selection may suggest a default, but this value is what is actually
  // submitted and is always authoritative.
  currency?: string;
  // Wizard/draft UI state only — tracks whether `currency` currently holds
  // a country-derived suggestion ("suggested", kept in sync when country
  // changes) or a value the user explicitly edited ("manual", preserved
  // across later country changes). Never sent to the API and never part
  // of persisted project business data — see submitProject.ts's payload
  // allowlist.
  currencyInputMode?: "suggested" | "manual";
};

export const initialWizardData: WizardData = {
  idea: "",
  businessName: undefined,
  industry: undefined,
  country: undefined,
  city: undefined,
  stage: undefined,
  audience: undefined,
  ageRange: undefined,
  customerType: undefined,
  goals: [],
  budget: undefined,
  timeline: undefined,
  currency: undefined,
  currencyInputMode: undefined,
};
