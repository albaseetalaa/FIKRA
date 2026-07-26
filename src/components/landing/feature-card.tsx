import type { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <article className="group overflow-hidden rounded-[2rem] border border-neutral-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(15,23,42,0.12)] dark:border-neutral-800 dark:bg-slate-900/85">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition group-hover:bg-brand-100 dark:bg-brand-900/20 dark:text-brand-200 dark:ring-brand-700/40">
        {icon}
      </div>
      <h3 className="mt-6 text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-neutral-600 dark:text-neutral-300">
        {description}
      </p>
    </article>
  );
}
