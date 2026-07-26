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
}: {
  step: number;
  total: number;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white/50">
          Back
        </button>
        <button onClick={onSaveDraft} className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
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
          <>
            <button onClick={onSubmit} className="rounded-full bg-brand-700 px-6 py-3 text-sm font-semibold text-white">
              Create My Project
            </button>
          </>
        )}
      </div>
    </div>
  );
}
