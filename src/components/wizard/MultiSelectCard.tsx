"use client";

import React from "react";

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}

export default function MultiSelectCard({ label, options, selected, onChange }: Props) {
  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  }

  return (
    <div>
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition ${
                isSelected
                  ? "border-brand-600 bg-brand-600/10 text-brand-700 dark:bg-brand-600/10"
                  : "border-white/8 bg-white/95 text-slate-800 dark:bg-slate-900/70"
              }`}
            >
              <span className="text-sm">{opt}</span>
              <span className="text-xs font-semibold">{isSelected ? "Selected" : ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
