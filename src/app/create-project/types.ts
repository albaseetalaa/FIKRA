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
  budget?: string;
  timeline?: string;
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
};
