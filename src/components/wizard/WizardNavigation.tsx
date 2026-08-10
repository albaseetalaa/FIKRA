"use client";

import React from "react";

import { Button } from "@/components/ui/button";

const CREATE_PENDING_LABEL = "Creating...";

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
        <Button variant="ghost" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button variant="secondary" onClick={onSaveDraft} disabled={submitting}>
          Save Draft
        </Button>
      </div>

      <div className="flex items-center gap-3">
        {step < total ? (
          <Button onClick={onContinue} disabled={!canContinue}>
            Continue
          </Button>
        ) : (
          <>
            <span role="status" className="sr-only">
              {submitting ? CREATE_PENDING_LABEL : ""}
            </span>
            <Button onClick={onSubmit} loading={submitting}>
              {submitting ? CREATE_PENDING_LABEL : "Create My Project"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
