import type { ReactNode } from "react";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  children,
}: SectionHeadingProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold uppercase tracking-[0.32em] text-brand-600 dark:text-brand-300">
        {eyebrow}
      </p>
      <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-4xl">
        {title}
      </h2>
      <p className="max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
        {description}
      </p>
      {children}
    </div>
  );
}
