"use client";

import Link from "next/link";
import React from "react";

type CapabilityView = {
  id: string;
  displayName: string;
  status: "available" | "generated" | "selected_but_not_available" | "coming_soon" | "failed" | "blocked" | "not_selected";
};

function capabilityStatusLabel(status: CapabilityView["status"]) {
  switch (status) {
    case "generated":
      return "Generated";
    case "available":
      return "Available";
    case "selected_but_not_available":
      return "Selected";
    case "coming_soon":
      return "Coming soon";
    case "blocked":
      return "Blocked";
    case "failed":
      return "Failed";
    default:
      return "Not selected";
  }
}

export default function Sidebar({ project, capabilities = [] }: { project?: string; capabilities?: CapabilityView[] }) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 border-r border-white/6 bg-slate-950/60 p-6 pt-8 dark:bg-transparent lg:flex">
      <div className="mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-300">Project</h3>
        <div className="mt-3 text-lg font-semibold text-white">{project || "Unnamed Project"}</div>
      </div>
      <nav className="flex flex-1 flex-col gap-2">
        <Link href="/workspace" className="rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-white/3">
          Overview
        </Link>
        {capabilities.map((capability) => (
          <Link
            key={capability.id}
            href="/workspace"
            className="rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-white/3"
          >
            <div className="flex items-center justify-between gap-2">
              <span>{capability.displayName}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{capabilityStatusLabel(capability.status)}</span>
            </div>
          </Link>
        ))}
      </nav>
      <div className="mt-auto text-sm text-slate-500">Fikra AI · Workspace</div>
    </aside>
  );
}
