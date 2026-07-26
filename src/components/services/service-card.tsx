import type { ReactNode } from "react";

interface ServiceCardProps {
  title: string;
  description: string;
  accent: string;
  deliverables: string[];
  icon: ReactNode;
  featured?: boolean;
}

export function ServiceCard({
  title,
  description,
  accent,
  deliverables,
  icon,
  featured = false,
}: ServiceCardProps) {
  return (
    <article className={`group relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950/95 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.18)] ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_40px_120px_rgba(15,23,42,0.22)] ${
      featured ? "lg:col-span-7" : ""
    }`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(236,72,153,0.1),_transparent_26%)] opacity-0 transition duration-700 group-hover:opacity-100" />
      <div className="relative z-10 flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br ${accent} text-white shadow-lg shadow-black/20`}>
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
          <p className="text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-5 shadow-inner shadow-black/10 transition duration-300 group-hover:border-white/20">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Deliverables</p>
        <ul className="mt-4 space-y-3 text-sm text-slate-300">
          {deliverables.map((deliverable) => (
            <li key={deliverable} className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-white/70" />
              <span>{deliverable}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
