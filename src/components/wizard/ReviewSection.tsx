"use client";

import React from "react";

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

export default function ReviewSection({ data, onEdit }: { data: WizardData; onEdit: (step: number) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white/90 p-4 dark:bg-slate-900/60">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Idea</h3>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{data.idea}</p>
        <button onClick={() => onEdit(1)} className="mt-3 text-sm font-medium text-brand-600">
          Edit
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white/90 p-4 dark:bg-slate-900/60">
          <h4 className="text-sm font-semibold">Business</h4>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{data.businessName || "—"}</p>
          <p className="mt-1 text-sm text-slate-500">{data.industry || "—"}</p>
          <p className="mt-1 text-sm text-slate-500">{[data.city, data.country].filter(Boolean).join(", ") || "—"}</p>
          <button onClick={() => onEdit(2)} className="mt-3 text-sm font-medium text-brand-600">
            Edit
          </button>
        </div>

        <div className="rounded-xl border bg-white/90 p-4 dark:bg-slate-900/60">
          <h4 className="text-sm font-semibold">Audience</h4>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{data.audience || "—"}</p>
          <p className="mt-1 text-sm text-slate-500">Age: {data.ageRange || "—"}</p>
          <p className="mt-1 text-sm text-slate-500">Type: {data.customerType || "—"}</p>
          <button onClick={() => onEdit(3)} className="mt-3 text-sm font-medium text-brand-600">
            Edit
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white/90 p-4 dark:bg-slate-900/60">
        <h4 className="text-sm font-semibold">Goals</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.goals.length ? data.goals.map((g) => <span key={g} className="rounded-full bg-white/80 px-3 py-1 text-sm">{g}</span>) : <span className="text-sm text-slate-500">—</span>}
        </div>
        <button onClick={() => onEdit(4)} className="mt-3 text-sm font-medium text-brand-600">
          Edit
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white/90 p-4 dark:bg-slate-900/60">
          <h4 className="text-sm font-semibold">Budget</h4>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{data.budget || "—"}</p>
          <button onClick={() => onEdit(5)} className="mt-3 text-sm font-medium text-brand-600">
            Edit
          </button>
        </div>
        <div className="rounded-xl border bg-white/90 p-4 dark:bg-slate-900/60">
          <h4 className="text-sm font-semibold">Timeline</h4>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{data.timeline || "—"}</p>
          <button onClick={() => onEdit(5)} className="mt-3 text-sm font-medium text-brand-600">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
