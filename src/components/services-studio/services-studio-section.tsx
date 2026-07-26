"use client";

import { useEffect, useRef, useState } from "react";
import { ServiceStudioCard } from "@/components/services-studio/service-studio-card";

interface ServiceStudioInfo {
  key: string;
  title: string;
  description: string;
  status: string;
  accent: string;
  icon: React.ReactNode;
  size: "large" | "medium" | "small";
}

const services: ServiceStudioInfo[] = [
  {
    key: "brand-identity",
    title: "Brand Identity",
    description: "Logo, colors, typography and complete visual identity.",
    status: "Live Studio",
    accent: "from-violet-500 to-purple-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 10.5v6" strokeLinecap="round" />
      </svg>
    ),
    size: "large",
  },
  {
    key: "website-development",
    title: "Website Development",
    description: "Modern responsive website powered by AI.",
    status: "Studio",
    accent: "from-sky-500 to-blue-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7h18M6 12h12M9 17h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    size: "medium",
  },
  {
    key: "ui-ux-design",
    title: "UI / UX Design",
    description: "Professional interfaces and user experience.",
    status: "Studio",
    accent: "from-cyan-500 to-teal-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16v16H4z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 8h8M8 12h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    size: "small",
  },
  {
    key: "marketing-assets",
    title: "Marketing Assets",
    description: "Social media, campaigns and launch materials.",
    status: "Studio",
    accent: "from-amber-500 to-yellow-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 5h14v14H5z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 11h10M7 15h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    size: "small",
  },
  {
    key: "packaging-design",
    title: "Packaging Design",
    description: "Premium packaging ready for production.",
    status: "Studio",
    accent: "from-emerald-500 to-emerald-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h16v10H4z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 7l8 5 8-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    size: "medium",
  },
  {
    key: "business-strategy",
    title: "Business Strategy",
    description: "Business model, positioning and launch roadmap.",
    status: "Studio",
    accent: "from-slate-400 to-slate-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 19h14M5 5l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    size: "small",
  },
  {
    key: "ai-automation",
    title: "AI Automation",
    description: "AI agents and workflow automation.",
    status: "Studio",
    accent: "from-indigo-500 to-violet-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    size: "small",
  },
  {
    key: "project-management",
    title: "Project Management",
    description: "Track every stage of your business launch.",
    status: "Studio",
    accent: "from-amber-500 to-orange-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 5h14M5 19h14M7 5v14M17 5v14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    size: "medium",
  },
];

export function ServicesStudioSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);
  return (
    <section
      ref={sectionRef}
      className={`relative overflow-hidden px-4 pb-24 pt-16 sm:px-6 lg:px-10 lg:pb-32 transition-all duration-700 will-change-transform ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.14),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.12),_transparent_18%)] blur-3xl" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-3xl rounded-[2rem] border border-white/10 bg-slate-950/95 p-10 shadow-[0_30px_100px_rgba(15,23,42,0.25)] ring-1 ring-white/10 backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-brand-300">AI Studio</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Everything you need to transform an idea into a real business.
          </h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          {services.map((svc) => {
            const { key, ...service } = svc;
            return (
              <div
                key={key}
                className={`${service.size === "large" ? "lg:col-span-7" : service.size === "medium" ? "lg:col-span-5" : "lg:col-span-4"} ${svc === services[0] ? "lg:row-span-2" : ""}`}>
                <ServiceStudioCard {...service} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
