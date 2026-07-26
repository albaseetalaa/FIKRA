import { HeroButton } from "@/components/hero/hero-button";
import { HeroGraphic } from "@/components/hero/hero-graphic";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-white px-4 py-24 sm:px-6 lg:px-10 xl:px-12 lg:py-28 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_30%)] blur-3xl" />
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="space-y-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand-600 dark:text-brand-300">
              Premium AI launch studio
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
              Build your business from idea to launch with AI.
            </h1>
            <p className="mt-6 text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
              Fikra AI helps entrepreneurs transform ideas into complete businesses, including branding, websites, marketing, packaging, and launch assets.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <HeroButton href="/create-project" variant="primary">
              Start Your Project
            </HeroButton>
            <HeroButton href="#demo" variant="secondary">
              Watch Demo
            </HeroButton>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[2rem] bg-white/90 p-5 text-sm text-slate-700 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-950/5 dark:bg-slate-900/80 dark:text-slate-200 dark:ring-white/10">
              <p className="font-semibold">Fast launches</p>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                From concept to MVP in days.
              </p>
            </div>
            <div className="rounded-[2rem] bg-white/90 p-5 text-sm text-slate-700 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-950/5 dark:bg-slate-900/80 dark:text-slate-200 dark:ring-white/10">
              <p className="font-semibold">Brand-ready</p>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Design, copy, and launch assets included.
              </p>
            </div>
            <div className="rounded-[2rem] bg-white/90 p-5 text-sm text-slate-700 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-950/5 dark:bg-slate-900/80 dark:text-slate-200 dark:ring-white/10">
              <p className="font-semibold">No backend needed</p>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Static launch pages that impress investors.
              </p>
            </div>
          </div>
        </div>
        <div className="relative">
          <HeroGraphic />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white dark:from-slate-950" />
        </div>
      </div>
    </section>
  );
}
