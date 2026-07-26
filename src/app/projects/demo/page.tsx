"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "fikra:create-project:draft:v1";
const DASHBOARD_ANIMATION_PENDING_KEY = "fikra:create-project:dashboard-animation-pending:v1";

const animationStages = [
  "Reviewing your brief",
  "Organizing project insights",
  "Preparing your workspace",
  "Finalizing recommendations",
] as const;

type WizardData = {
  idea: string;
  businessName?: string;
  industry?: string;
  country?: string;
  city?: string;
  stage?: string;
  audience?: string;
  ageRange?: string;
  customerType?: string;
  goals: string[];
  budget?: string;
  timeline?: string;
};

const fallbackData: WizardData = {
  idea: "A premium boutique bakery in Riyadh with a strong focus on handcrafted breakfasts, wellness-minded pastries, and tailored corporate catering.",
  businessName: "Sahtein Studio",
  industry: "Restaurant & Food",
  country: "Saudi Arabia",
  city: "Riyadh",
  stage: "Planning",
  audience: "Professionals seeking quick, healthy morning options",
  ageRange: "18-35",
  customerType: "Individuals",
  goals: ["Build a brand identity", "Create a website", "Build social media assets", "Prepare a launch campaign"],
  budget: "SAR 15,000–50,000",
  timeline: "Within 3 months",
};

function createReport(data: WizardData) {
  const title = data.businessName || "New AI Business Launch";
  const opportunity = data.industry === "Restaurant & Food" ? "High demand for fresh breakfast experiences in urban Saudi markets." : "Strong growth opportunity in a fast-moving consumer segment.";

  return {
    title,
    summary: `${title} is positioned to deliver an elevated business experience for ${data.audience || "a premium audience"} in ${data.city || data.country || "the region"}. The plan blends brand, digital presence, and launch strategy into one connected growth path.`,
    model: data.industry === "Technology" ? "Subscription-enabled SaaS product offering modular business tools." : data.industry === "Restaurant & Food" ? "A hospitality-first value chain combining dining, delivery, and seasonal retail." : "A service-driven model built around repeat customer experiences and strategic digital distribution.",
    audience: `${data.audience || "Modern consumers"} aged ${data.ageRange || "25-45"} who prioritize quality, convenience, and authenticity.`,
    uvp: `A polished brand experience that turns everyday moments into memorable customer journeys by combining crafted service with digital-first discovery.`,
    brand: `Warm, luminous brand direction with elegant Arabic geometry, expressive typography, and soft gradients that convey premium accessibility.`,
    suggestedName: data.businessName || "Sahtein Studio",
    actions: [
      "Finalize brand identity and visual system",
      "Launch a mobile-responsive website with ordering and storytelling",
      "Activate social campaigns focused on local discovery",
      "Prepare a phased launch roadmap with pre-opening buzz",
    ],
    timeline: `Target launch ${data.timeline?.toLowerCase() || "in the next quarter"} with prioritized milestones for identity, site, and marketing.`,
    market: opportunity,
    score: 88,
  };
}

export default function DemoProject() {
  const [data, setData] = useState<WizardData | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setData(raw ? (JSON.parse(raw) as WizardData) : fallbackData);
    } catch {
      setData(fallbackData);
    }

    try {
      const pending = localStorage.getItem(DASHBOARD_ANIMATION_PENDING_KEY) === "true";
      if (pending && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        localStorage.removeItem(DASHBOARD_ANIMATION_PENDING_KEY);
        setShowIntro(false);
        return;
      }
      if (pending) {
        localStorage.removeItem(DASHBOARD_ANIMATION_PENDING_KEY);
        setShowIntro(true);
      }
    } catch {
      setShowIntro(false);
    }
  }, []);

  useEffect(() => {
    if (!showIntro) return;

    const interval = window.setInterval(() => {
      setProgress((current) => Math.min(100, current + 2.5));
    }, 90);

    const timeout = window.setTimeout(() => {
      setShowIntro(false);
    }, 3800);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [showIntro]);

  const stageIndex = Math.min(animationStages.length - 1, Math.floor((progress / 100) * animationStages.length));
  const report = useMemo(() => createReport(data || fallbackData), [data]);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.32em] text-brand-300">AI Business Report</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">{report.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{report.summary}</p>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="grid gap-6">
            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 shadow-[0_20px_50px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Business Summary</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">A business built for discovery and loyalty.</h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">Launch Score {report.score}</div>
              </div>
              <p className="mt-6 text-sm leading-7 text-slate-300">{report.summary}</p>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Business Model</p>
                <p className="mt-4 text-sm leading-7 text-slate-300">{report.model}</p>
              </section>
              <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Market Opportunity</p>
                <p className="mt-4 text-sm leading-7 text-slate-300">{report.market}</p>
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Target Audience</p>
                <p className="mt-4 text-sm leading-7 text-slate-300">{report.audience}</p>
              </section>
              <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Unique Value Proposition</p>
                <p className="mt-4 text-sm leading-7 text-slate-300">{report.uvp}</p>
              </section>
            </div>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Brand Direction</p>
              <p className="mt-4 text-sm leading-7 text-slate-300">{report.brand}</p>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Suggested Business Name</p>
              <p className="mt-4 text-lg font-semibold text-white">{report.suggestedName}</p>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Timeline</p>
              <p className="mt-4 text-sm leading-7 text-slate-300">{report.timeline}</p>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Next Recommended Actions</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                {report.actions.map((action) => (
                  <li key={action} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-brand-300" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
      {showIntro ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl transition-opacity duration-500">
          <div className="mx-auto w-full max-w-3xl rounded-[2rem] border border-white/10 bg-slate-900/95 p-10 shadow-[0_40px_120px_rgba(15,23,42,0.45)]">
            <p className="text-sm uppercase tracking-[0.32em] text-brand-300">AI Report is initializing</p>
            <h2 className="mt-4 text-3xl font-semibold text-white">Finalizing your intelligence dashboard</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">One moment while Fikra prepares the most relevant insights for your project.</p>

            <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/90 p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <p className="text-sm text-slate-400">{animationStages[stageIndex]}</p>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">{Math.round(progress)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-500 via-cyan-400 to-slate-100 transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {animationStages.map((stage, index) => (
                  <div
                    key={stage}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      index <= stageIndex
                        ? "border-brand-500/30 bg-brand-500/10 text-white"
                        : "border-white/10 bg-slate-950/70 text-slate-400"
                    }`}
                  >
                    {stage}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
