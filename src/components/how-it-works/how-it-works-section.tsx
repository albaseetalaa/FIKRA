import { StageCard } from "@/components/how-it-works/stage-card";

const stages = [
  {
    key: "idea",
    title: "Idea",
    description: "Describe your business idea in your own words.",
    accent: "from-violet-500 to-purple-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3C8.134 3 5 6.134 5 10c0 3.141 2.128 5.78 5 6.708V21h2v-4.292c2.872-.928 5-3.567 5-6.708 0-3.866-3.134-7-7-7Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "strategy",
    title: "Strategy",
    description: "Fikra AI turns your idea into a clear business and brand direction.",
    accent: "from-sky-500 to-blue-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 11h8M8 15h5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 4.5 5.5 8.5v7l6.5 4 6.5-4v-7L12 4.5Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "design",
    title: "Design",
    description: "Generate your identity, website, packaging, and launch assets.",
    accent: "from-teal-500 to-cyan-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 14.5 3.5 21h17L17 14.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.5 10.5 12 7l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 7v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "development",
    title: "Development",
    description: "Build the digital experience and connect the tools your business needs.",
    accent: "from-emerald-500 to-emerald-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m8 8 4-4 4 4M8 16l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "launch",
    title: "Launch",
    description: "Review, refine, and launch with everything organized in one workspace.",
    accent: "from-amber-500 to-yellow-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2 7 13h10L12 2Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 22h14" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function HowItWorksSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-10 sm:px-6 lg:px-10 lg:pb-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_25%),radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_20%)] blur-3xl" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl rounded-[2rem] border border-white/10 bg-slate-950/95 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.25)] ring-1 ring-white/10 backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-brand-300">How it works</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            The Fikra AI journey from idea to launch.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
            A guided progress system with five essential stages that keeps your launch process clear, confident, and beautifully organized.
          </p>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute left-12 top-32 hidden h-px w-[calc(100%-4.5rem)] bg-gradient-to-r from-transparent via-white/10 to-transparent lg:block" />
          <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
            {stages.map((stage, index) => (
              <StageCard
                key={stage.key}
                title={stage.title}
                description={stage.description}
                accent={stage.accent}
                icon={stage.icon}
                isLast={index === stages.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
