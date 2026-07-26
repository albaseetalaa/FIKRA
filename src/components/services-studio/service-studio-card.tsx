import type { ReactNode } from "react";

interface ServiceStudioCardProps {
  title: string;
  description: string;
  status: string;
  accent: string;
  icon: ReactNode;
  size: "large" | "medium" | "small";
}

const sizeClasses: Record<ServiceStudioCardProps["size"], string> = {
  large: "lg:col-span-7",
  medium: "lg:col-span-5",
  small: "lg:col-span-4",
};

export function ServiceStudioCard({ title, description, status, accent, icon, size }: ServiceStudioCardProps) {
  return (
    <article className={`group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950/95 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.22)] ring-1 ring-white/10 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_40px_120px_rgba(15,23,42,0.26)] ${sizeClasses[size]}`}>
      <div className="pointer-events-none absolute -left-8 top-10 h-28 w-28 rounded-full bg-gradient-to-br from-brand-500/10 to-transparent opacity-0 transition duration-700 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -right-8 bottom-10 h-28 w-28 rounded-full bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 transition duration-700 group-hover:opacity-100" />
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br ${accent} text-white shadow-lg shadow-black/25`}>
          {icon}
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-slate-200 shadow-sm shadow-black/10">
          {status}
        </span>
      </div>
      <div className="mt-8 space-y-5">
        <h3 className="text-2xl font-semibold tracking-tight text-white">{title}</h3>
        <p className="text-sm leading-7 text-slate-300">{description}</p>
      </div>
      <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-brand-300 transition group-hover:translate-x-1">
        <span>Explore</span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-brand-300 shadow-sm shadow-black/10">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </article>
  );
}
