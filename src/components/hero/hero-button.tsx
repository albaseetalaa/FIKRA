import Link from "next/link";
import type { ReactNode } from "react";

interface HeroButtonProps {
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}

const baseStyles =
  "inline-flex items-center justify-center rounded-full px-7 py-3 text-sm font-semibold transition duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

const variantStyles: Record<NonNullable<HeroButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-700 text-white shadow-[0_20px_60px_rgba(58,99,245,0.25)] hover:bg-brand-800 dark:bg-brand-500 dark:hover:bg-brand-400",
  secondary:
    "border border-white/20 bg-white/95 text-slate-950 shadow-sm shadow-slate-900/10 hover:bg-white dark:border-slate-700 dark:bg-slate-950/90 dark:text-white dark:hover:bg-slate-900",
};

export function HeroButton({ href, variant = "primary", children }: HeroButtonProps) {
  return (
    <Link href={href} className={`${baseStyles} ${variantStyles[variant]}`}>
      {children}
    </Link>
  );
}
