"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import WizardLayout from "@/components/wizard/WizardLayout";
import ProgressIndicator from "@/components/wizard/ProgressIndicator";
import StepHeader from "@/components/wizard/StepHeader";
import TextAreaField from "@/components/wizard/fields/TextAreaField";
import TextField from "@/components/wizard/fields/TextField";
import SelectField from "@/components/wizard/fields/SelectField";
import MultiSelectCard from "@/components/wizard/MultiSelectCard";
import ReviewSection from "@/components/wizard/ReviewSection";
import WizardNavigation from "@/components/wizard/WizardNavigation";

import { loadDraft, saveDraft } from "./draftStorage";
import { createProjectSubmitter } from "./submitProject";
import { initialWizardData, type WizardData } from "./types";
import {
  BUDGET_RANGE_OPTIONS,
  LAUNCH_TIMELINE_OPTIONS,
  suggestCurrencyForCountry,
} from "@/ai/context/budgetTimelineOptions";
import { isValidCurrencyCode } from "@/ai/context/currencyCatalog";
import { formatCurrencyMismatchNotice, syncCurrencyForCountry } from "./currencySync";

export default function CreateProjectWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [data, setData] = useState<WizardData>(() => loadDraft(userId, initialWizardData));
  const submitRef = useRef(createProjectSubmitter());

  const totalSteps = 6;

  const canContinue = useMemo(() => {
    if (step === 1) return data.idea.trim().length > 10;
    if (step === 2) return !!data.industry && !!data.country;
    if (step === 3) return !!data.audience;
    if (step === 4) return data.goals.length > 0;
    if (step === 5) return !!data.budget && !!data.timeline && isValidCurrencyCode(data.currency);
    return true;
  }, [step, data]);

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  // Keep currency in sync with the selected country, without ever
  // overwriting a value the user explicitly chose. See currencySync.ts for
  // the (independently tested) sync rule and currencyInputMode's meaning.
  useEffect(() => {
    const next = syncCurrencyForCountry(
      { currency: data.currency, currencyInputMode: data.currencyInputMode },
      data.country,
      suggestCurrencyForCountry,
    );
    if (next.currency !== data.currency) update("currency", next.currency);
    if (next.currencyInputMode !== data.currencyInputMode) update("currencyInputMode", next.currencyInputMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.country]);

  function next() {
    if (!canContinue) return;
    setStep((s) => Math.min(totalSteps, s + 1));
  }

  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  function saveDraftNow() {
    const saved = saveDraft(userId, data);
    setDraftSavedAt(saved ? Date.now() : null);
    setSubmitError(saved ? null : "Could not save draft to this device's local storage.");
  }

  async function submit() {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    const result = await submitRef.current(data);

    if (!result.ok) {
      setSubmitError(result.message);
      setSubmitting(false);

      if (result.kind === "auth") {
        router.push(`/login?next=${encodeURIComponent("/create-project")}`);
      }
      return;
    }

    router.push(`/create-project/processing?projectId=${encodeURIComponent(result.projectId)}`);
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
                <TextField
                  label="Currency (3-letter code, e.g. JOD)"
                  value={data.currency || ""}
                  onChange={(v) => {
                    const normalized = v.trim().toUpperCase();
                    update("currency", normalized || undefined);
                    update("currencyInputMode", "manual");
                  }}
                  required
                />
                {data.currency && !isValidCurrencyCode(data.currency) ? (
                  <p className="text-xs text-rose-500 sm:col-span-2">
                    Currency must be a 3-letter code, such as JOD, USD, or SAR.
                  </p>
                ) : null}
                {data.currencyInputMode === "manual" && data.currency && isValidCurrencyCode(data.currency) ? (() => {
                  const suggested = suggestCurrencyForCountry(data.country);
                  if (!suggested || suggested === data.currency) return null;
                  return (
                    <p className="text-xs text-slate-500 sm:col-span-2">
                      {formatCurrencyMismatchNotice(data.country, data.currency, suggested)}
                    </p>
                  );
                })() : null}
                <SelectField
                  label="Estimated budget"
                  value={data.budget}
                  onChange={(v) => update("budget", v)}
                  options={BUDGET_RANGE_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
                  required
                />
                <SelectField
                  label="Desired launch timeline"
                  value={data.timeline}
                  onChange={(v) => update("timeline", v)}
                  options={LAUNCH_TIMELINE_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
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
            onSaveDraft={saveDraftNow}
            onSubmit={submit}
            submitting={submitting}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Draft is saved locally on this device only — it is not uploaded until you create your project.
          </p>
          {draftSavedAt ? <p className="text-sm text-emerald-600 dark:text-emerald-400">Draft saved locally.</p> : null}
          {submitError ? <p className="text-sm text-rose-500">{submitError}</p> : null}
          {submitting ? <p className="text-sm text-slate-500">Starting AI workflow...</p> : null}
        </div>
      </div>
    </WizardLayout>
  );
}
