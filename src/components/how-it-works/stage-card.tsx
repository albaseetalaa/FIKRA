import type { ReactNode } from "react";

interface StageCardProps {
  title: string;
  description: string;
  accent: string;
  icon: ReactNode;
  isLast?: boolean;
}

export function StageCard({ title, description, accent, icon, isLast }: StageCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 pl-24 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/15">
      <div className="absolute inset-y-0 start-6 flex items-center justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-900/90 ring-1 ring-white/10 shadow-lg shadow-black/20">
          <div className={`flex h-11 w-11 items-center justify-center rounded-3xl bg-gradient-to-br ${accent} text-white motion-safe:animate-pulse`}>
            {icon}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
        <p className="text-sm leading-7 text-slate-300">{description}</p>
      </div>
      {!isLast ? (
        <div className="pointer-events-none absolute start-12 top-full mt-6 h-14 w-px bg-gradient-to-b from-white/15 to-transparent sm:hidden" />
      ) : null}
    </div>
  );
}
