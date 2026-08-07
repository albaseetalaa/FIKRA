"use client";

import React from "react";

export default function WizardNavigation({
  step,
  total,
  onBack,
  onContinue,
  canContinue,
  onSaveDraft,
  onSubmit,
  submitting = false,
}: {
  step: number;
  total: number;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          disabled={submitting}
          className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Back
        </button>
        <button
          onClick={onSaveDraft}
          disabled={submitting}
          className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Draft
        </button>
      </div>

      <div className="flex items-center gap-3">
        {step < total ? (
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className={`rounded-full px-6 py-3 text-sm font-semibold text-white ${
              canContinue ? "bg-brand-700 hover:bg-brand-800" : "bg-white/8 cursor-not-allowed"
            }`}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={submitting}
            aria-busy={submitting}
            className={`rounded-full px-6 py-3 text-sm font-semibold text-white ${
              submitting ? "cursor-not-allowed bg-white/8" : "bg-brand-700 hover:bg-brand-800"
            }`}
          >
            {submitting ? "Creating..." : "Create My Project"}
          </button>
        )}
      </div>
    </div>
  );
}
