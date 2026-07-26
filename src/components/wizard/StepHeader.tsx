import React from "react";

const titles: Record<number, string> = {
  1: "The Idea",
  2: "Business Basics",
  3: "Audience",
  4: "Goals",
  5: "Budget & Timeline",
  6: "Review",
};

export default function StepHeader({ step }: { step: number }) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-brand-600">Step {step} of 6</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{titles[step]}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{step === 1 ? "Describe the idea naturally. No technical language required." : ""}</p>
      </div>
    </header>
  );
}
