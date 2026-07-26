import React from "react";

export default function ProgressIndicator({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="flex items-center gap-4">
      <div className="flex w-full items-center gap-4">
        <div className="flex-1">
          <div className="h-2 w-full rounded-full bg-white/8">
            <div className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="w-20 text-right text-sm font-medium text-slate-600 dark:text-slate-300">{pct}%</div>
      </div>
    </div>
  );
}
