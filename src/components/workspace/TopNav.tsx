"use client";

import React from "react";
import Link from "next/link";

export default function TopNav({ project }: { project?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-white/6 bg-slate-950/60 px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="text-sm font-semibold text-white">{project || "Unnamed Project"}</div>
        <div className="hidden text-sm text-slate-400 sm:block">Overview</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-400">AI Status: <span className="font-medium text-white">Idle</span></div>
        <Link href="/projects" className="rounded-full bg-white/6 px-3 py-2 text-sm text-white">
          Projects
        </Link>
      </div>
    </header>
  );
}
