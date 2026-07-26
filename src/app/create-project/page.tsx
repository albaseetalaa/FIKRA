"use client";

import { useEffect, useMemo, useState } from "react";
import WizardLayout from "@/components/wizard/WizardLayout";
import ProgressIndicator from "@/components/wizard/ProgressIndicator";
import StepHeader from "@/components/wizard/StepHeader";
import TextAreaField from "@/components/wizard/fields/TextAreaField";
import TextField from "@/components/wizard/fields/TextField";
import SelectField from "@/components/wizard/fields/SelectField";
import MultiSelectCard from "@/components/wizard/MultiSelectCard";
import ReviewSection from "@/components/wizard/ReviewSection";
import WizardNavigation from "@/components/wizard/WizardNavigation";
import { useRouter } from "next/navigation";

type WizardData = {
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

const STORAGE_KEY = "fikra:create-project:draft:v1";

const initialData: WizardData = {
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

export default function CreateProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<WizardData>(() => {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as WizardData) : initialData;
    } catch {
      return initialData;
    }
  });
  const [_touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [data]);

  const totalSteps = 6;

  const canContinue = useMemo(() => {
    if (step === 1) return data.idea.trim().length > 10;
    if (step === 2) return !!data.industry && !!data.country;
    if (step === 3) return !!data.audience;
    if (step === 4) return data.goals.length > 0;
    if (step === 5) return !!data.budget && !!data.timeline;
    return true;
  }, [step, data]);

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setTouched((t) => ({ ...t, [String(key)]: true }));
  }

  function next() {
    if (!canContinue) return;
    setStep((s) => Math.min(totalSteps, s + 1));
  }

  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      alert("Draft saved locally");
    } catch {
      alert("Could not save draft");
    }
  }

  async function submit() {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      const createRes = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: data.idea }),
      });

      if (!createRes.ok) {
        const payload = (await createRes.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not create project.");
      }

      const created = (await createRes.json()) as { projectId: string };

      const startRes = await fetch("/api/projects/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: created.projectId }),
      });

      if (!startRes.ok) {
        const payload = (await startRes.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not start execution.");
      }

      router.push(`/create-project/processing?projectId=${encodeURIComponent(created.projectId)}`);
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "Could not start project generation.");
      setSubmitting(false);
    }
  }

  return (
    <WizardLayout>
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <ProgressIndicator step={step} total={totalSteps} />

        <div className="mt-8 space-y-6">
          <StepHeader step={step} />

          <div className="rounded-2xl border border-white/8 bg-slate-50/80 p-6 dark:bg-slate-900/60 dark:border-white/6">
            {step === 1 && (
              <div>
                <TextAreaField
                  label="What would you like to build?"
                  placeholder={`I want to launch a healthy breakfast restaurant in Amman focused on egg sandwiches and fresh salads.`}
                  value={data.idea}
                  onChange={(v) => update("idea", v)}
                  required
                />
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Business name (optional)" value={data.businessName || ""} onChange={(v) => update("businessName", v || undefined)} />
                <SelectField
                  label="Industry"
                  value={data.industry}
                  onChange={(v) => update("industry", v)}
                  options={[
                    "Restaurant & Food",
                    "Retail & E-commerce",
                    "Technology",
                    "Professional Services",
                    "Fashion & Beauty",
                    "Real Estate",
                    "Healthcare",
                    "Education",
                    "Other",
                  ]}
                  required
                />

                <TextField label="Country" value={data.country || ""} onChange={(v) => update("country", v || undefined)} required />
                <TextField label="City" value={data.city || ""} onChange={(v) => update("city", v || undefined)} />

                <SelectField
                  label="Business stage"
                  value={data.stage}
                  onChange={(v) => update("stage", v)}
                  options={["Just an idea", "Planning", "Already operating", "Rebranding", "Expanding"]}
                />
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Target audience" value={data.audience || ""} onChange={(v) => update("audience", v || undefined)} required />
                <TextField label="Customer age range" value={data.ageRange || ""} onChange={(v) => update("ageRange", v || undefined)} />
                <SelectField label="Customer type" value={data.customerType} onChange={(v) => update("customerType", v)} options={["Individuals", "Businesses", "Both"]} />
              </div>
            )}

            {step === 4 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <MultiSelectCard
                  label="Goals"
                  options={[
                    "Build a brand identity",
                    "Create a website",
                    "Create packaging",
                    "Build social media assets",
                    "Prepare a launch campaign",
                    "Develop a business strategy",
                    "Design a physical space",
                    "Automate business workflows",
                  ]}
                  selected={data.goals}
                  onChange={(v) => update("goals", v)}
                />
              </div>
            )}

            {step === 5 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Estimated budget"
                  value={data.budget}
                  onChange={(v) => update("budget", v)}
                  options={["Under SAR 5,000", "SAR 5,000–15,000", "SAR 15,000–50,000", "SAR 50,000+", "Not sure yet"]}
                  required
                />
                <SelectField
                  label="Desired launch timeline"
                  value={data.timeline}
                  onChange={(v) => update("timeline", v)}
                  options={["As soon as possible", "Within 30 days", "Within 3 months", "Within 6 months", "Flexible"]}
                  required
                />
              </div>
            )}

            {step === 6 && <ReviewSection data={data} onEdit={(s) => setStep(s)} />}
          </div>

          <WizardNavigation
            step={step}
            total={totalSteps}
            onBack={back}
            onContinue={next}
            canContinue={canContinue}
            onSaveDraft={saveDraft}
            onSubmit={submit}
          />
          {submitError ? <p className="text-sm text-rose-500">{submitError}</p> : null}
          {submitting ? <p className="text-sm text-slate-500">Starting AI workflow...</p> : null}
        </div>
      </div>
    </WizardLayout>
  );
}
