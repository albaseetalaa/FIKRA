"use client";

import Link from "next/link";
import React from "react";

const items = [
  "Overview",
  "Business Plan",
  "Market Research",
  "Competitor Analysis",
  "Financial Model",
  "Brand Identity",
  "Logo",
  "Visual Identity",
  "Website",
  "Packaging",
  "Social Media",
  "Marketing Strategy",
  "Operations",
  "Investor Pitch",
  "Documents",
  "AI Agents",
  "Settings",
];

export default function Sidebar({ project }: { project?: string }) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 border-r border-white/6 bg-slate-950/60 p-6 pt-8 dark:bg-transparent lg:flex">
      <div className="mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-300">Project</h3>
        <div className="mt-3 text-lg font-semibold text-white">{project || "Demo Project"}</div>
      </div>
      <nav className="flex flex-1 flex-col gap-2">
        {items.map((it) => (
          <Link
            key={it}
            href={it === "AI Agents" ? "/workspace/agents" : `/workspace`}
            className="rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-white/3"
          >
            {it}
          </Link>
        ))}
      </nav>
      <div className="mt-auto text-sm text-slate-500">Fikra AI · Workspace</div>
    </aside>
  );
}
