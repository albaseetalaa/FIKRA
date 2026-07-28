"use client";

import React from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

type CapabilityView = {
  id: string;
  displayName: string;
  status: "available" | "generated" | "selected_but_not_available" | "coming_soon" | "failed" | "blocked" | "not_selected";
};

export default function WorkspaceLayout({ children, project, capabilities = [] }: { children: React.ReactNode; project?: string; capabilities?: CapabilityView[] }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <TopNav project={project} />
      <div className="mx-auto max-w-7xl grid grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[minmax(18rem,1fr)_1fr]">
        <Sidebar project={project} capabilities={capabilities} />
        <main className="min-h-[60vh] rounded-2xl">{children}</main>
      </div>
    </div>
  );
}
