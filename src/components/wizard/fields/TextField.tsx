"use client";

import React from "react";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}

export default function TextField({ label, value, onChange, required }: Props) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{label} {required ? <span className="text-rose-500">*</span> : null}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-white/8 bg-white/90 p-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-900/70 dark:text-slate-100"
      />
    </label>
  );
}
