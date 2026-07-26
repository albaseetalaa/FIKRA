"use client";

import React from "react";

interface Props {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}

export default function TextAreaField({ label, placeholder, value, onChange, required }: Props) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{label} {required ? <span className="text-rose-500">*</span> : null}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className="mt-2 w-full resize-none rounded-lg border border-white/8 bg-white/90 p-4 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-900/70 dark:text-slate-100"
      />
    </label>
  );
}
