import { ServiceCard } from "@/components/services/service-card";

interface ServiceInfo {
  key: string;
  title: string;
  description: string;
  accent: string;
  deliverables: string[];
  icon: React.ReactNode;
  featured?: boolean;
}

const services: ServiceInfo[] = [
  {
    key: "brand-identity",
    title: "Brand Identity",
    description: "Create your logo, color system, typography, brand voice, and complete brand guidelines.",
    accent: "from-violet-500 to-purple-600",
    deliverables: ["Logo system", "Color palette", "Typography", "Brand voice", "Brand guidelines"],
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 10.5v6" strokeLinecap="round" />
      </svg>
    ),
    featured: true,
  },
  {
    key: "website-studio",
    title: "Website Studio",
    description: "Plan and create a polished website aligned with your brand and business goals.",
    accent: "from-sky-500 to-blue-600",
    deliverables: ["Website strategy", "Sitemap", "Landing pages", "Responsive UI", "Launch-ready structure"],
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6h16M4 10h16M6 16h12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    featured: true,
  },
  {
    key: "restaurant-studio",
    title: "Restaurant Studio",
    description: "Build a complete restaurant brand experience from menu to packaging and digital presence.",
    accent: "from-cyan-500 to-teal-500",
    deliverables: ["Menu design", "Product presentation", "Packaging", "Signage", "Delivery assets"],
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 5h8v14H8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 5v14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "packaging-studio",
    title: "Packaging Studio",
    description: "Create packaging systems that feel consistent, distinctive, and production-ready.",
    accent: "from-emerald-500 to-emerald-600",
    deliverables: ["Product packaging", "Labels", "Boxes", "Bags", "Print-ready concepts"],
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h16v10H4z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 7l8 5 8-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "social-marketing",
    title: "Social & Marketing",
    description: "Generate campaigns and content that stay consistent with your brand identity.",
    accent: "from-amber-500 to-yellow-500",
    deliverables: ["Social posts", "Ad concepts", "Campaign assets", "Content direction", "Launch calendar"],
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 7h10M7 11h8M7 15h6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 19h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "architecture-interior",
    title: "Architecture & Interior",
    description: "Develop the visual direction for physical spaces that reflect the brand experience.",
    accent: "from-slate-400 to-slate-600",
    deliverables: ["Moodboards", "Interior direction", "Spatial branding", "Signage concepts", "Presentation boards"],
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 20h14V8H5v12Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 8V4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "expert-hub",
    title: "Expert Hub",
    description: "Escalate complex tasks to vetted human experts without losing project context.",
    accent: "from-indigo-500 to-violet-600",
    deliverables: ["Human review", "Specialized execution", "Project continuity", "Quality control", "Expert collaboration"],
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 18c0-2.2 2.7-4 6-4s6 1.8 6 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function ServicesSection() {
  return (
    <section className="relative overflow-hidden px-4 py-24 sm:px-6 lg:px-10 lg:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.14),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.12),_transparent_18%)] blur-3xl" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 max-w-3xl rounded-[2rem] border border-white/10 bg-slate-950/95 p-10 shadow-[0_30px_100px_rgba(15,23,42,0.25)] ring-1 ring-white/10 backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-brand-300">WHAT YOU CAN BUILD</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Everything your business needs, in one intelligent workspace.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-400 sm:text-lg">
            Build your brand, digital presence, marketing, and launch assets without switching between disconnected tools or managing multiple freelancers.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ServiceCard {...services[0]!} featured />
          </div>
          <div className="lg:col-span-5">
            <ServiceCard {...services[1]!} featured />
          </div>
          <div className="lg:col-span-4">
            <ServiceCard {...services[2]!} />
          </div>
          <div className="lg:col-span-4">
            <ServiceCard {...services[3]!} />
          </div>
          <div className="lg:col-span-4">
            <ServiceCard {...services[4]!} />
          </div>
          <div className="lg:col-span-6">
            <ServiceCard {...services[5]!} />
          </div>
          <div className="lg:col-span-6">
            <ServiceCard {...services[6]!} />
          </div>
        </div>
        <div className="mt-14 rounded-[2rem] border border-white/10 bg-slate-950/95 p-10 shadow-[0_30px_100px_rgba(15,23,42,0.22)] ring-1 ring-white/10 backdrop-blur-xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-white">Start with one idea. Build everything around it.</h3>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
                Explore Fikra Studios for a connected creative workflow that keeps every part of your business aligned and launch-ready.
              </p>
            </div>
            <button className="inline-flex items-center justify-center rounded-full bg-brand-700 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:focus-visible:ring-brand-300">
              Explore Fikra Studios
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
