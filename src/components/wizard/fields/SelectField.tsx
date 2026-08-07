"use client";

import React from "react";

export type SelectOption = string | { value: string; label: string };

interface Props {
  label: string;
  value?: string;
  onChange: (v?: string) => void;
  options: SelectOption[];
  required?: boolean;
}

function normalizeOption(opt: SelectOption): { value: string; label: string } {
  return typeof opt === "string" ? { value: opt, label: opt } : opt;
}

export default function SelectField({ label, value, onChange, options, required }: Props) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{label} {required ? <span className="text-rose-500">*</span> : null}</div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="mt-2 w-full rounded-lg border border-white/8 bg-white/90 p-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-900/70 dark:text-slate-100"
      >
        <option value="">Select...</option>
        {options.map(normalizeOption).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
