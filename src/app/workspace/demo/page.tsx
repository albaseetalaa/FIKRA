"use client";

import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type BusinessPlan = {
  executiveSummary: string;
  objectives: string[];
  targetMarket: string;
  revenueModel: string;
  milestones: Array<{ title: string; dueDate?: string }>;
};

type ProjectStatusResponse = {
  projectId: string;
  idea: string;
  status: "queued" | "running" | "completed" | "failed";
  errorMessage: string | null;
  businessPlan: BusinessPlan | null;
};

function WorkspaceDemoContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const [projectStatus, setProjectStatus] = useState<ProjectStatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const score = useMemo(() => {
    const status = projectStatus?.status;
    if (status === "completed") return 92;
    if (status === "running") return 55;
    if (status === "failed") return 30;
    return 20;
  }, [projectStatus?.status]);

  useEffect(() => {
    if (!projectId) return;

    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/projects/status/${encodeURIComponent(projectId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load project status.");
        const payload = (await res.json()) as ProjectStatusResponse;
        if (stop) return;

        setProjectStatus(payload);
        setLoadError(null);

        if (payload.status === "queued" || payload.status === "running") {
          window.setTimeout(poll, 1000);
        }
      } catch (error: unknown) {
        if (stop) return;
        setLoadError(error instanceof Error ? error.message : "Could not load project status.");
      }
    };

    void poll();
    return () => {
      stop = true;
    };
  }, [projectId]);

  const milestones = projectStatus?.businessPlan?.milestones ?? [];

  return (
    <WorkspaceLayout project={projectStatus?.projectId ?? "Project Workspace"}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="col-span-2 space-y-6">
          <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Project Score</p>
                <h3 className="mt-2 text-3xl font-semibold text-white">{Math.round(score)}</h3>
              </div>
              <div className="text-sm text-slate-400">Execution Status: {projectStatus?.status ?? "queued"}</div>
            </div>
            <div className="mt-6 h-3 w-full rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400" style={{ width: `${score}%` }} />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Business Plan</p>
            {!projectId ? <p className="mt-4 text-sm text-slate-400">No project selected.</p> : null}
            {loadError ? <p className="mt-4 text-sm text-rose-400">{loadError}</p> : null}
            {projectStatus?.status === "failed" && projectStatus.errorMessage ? <p className="mt-4 text-sm text-rose-400">{projectStatus.errorMessage}</p> : null}
            {projectStatus?.businessPlan ? (
              <div className="mt-4 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Executive Summary</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">{projectStatus.businessPlan.executiveSummary}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-400">Target Market</p>
                    <p className="mt-2 text-sm font-medium text-white">{projectStatus.businessPlan.targetMarket}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-400">Revenue Model</p>
                    <p className="mt-2 text-sm font-medium text-white">{projectStatus.businessPlan.revenueModel}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Objectives</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-200">
                    {projectStatus.businessPlan.objectives.map((objective) => (
                      <li key={objective} className="rounded-lg bg-slate-950/60 px-3 py-2">
                        {objective}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Milestones</p>
                  {milestones.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">No milestones returned.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-slate-200">
                      {milestones.map((milestone) => (
                        <li key={`${milestone.title}-${milestone.dueDate ?? "none"}`} className="rounded-lg bg-slate-950/60 px-3 py-2">
                          {milestone.title}
                          {milestone.dueDate ? ` - ${milestone.dueDate}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Business Plan will appear here once execution completes.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.28em] text-brand-300">AI Progress</p>
            <p className="mt-3 text-sm text-slate-300">Current state: {projectStatus?.status ?? "queued"}</p>
            {projectStatus?.status === "queued" ? <p className="mt-2 text-sm text-slate-400">Queued</p> : null}
            {projectStatus?.status === "running" ? <p className="mt-2 text-sm text-slate-400">Running</p> : null}
            {projectStatus?.status === "completed" ? <p className="mt-2 text-sm text-emerald-300">Completed</p> : null}
            {projectStatus?.status === "failed" ? <p className="mt-2 text-sm text-rose-300">Failed</p> : null}
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Recommended Next Steps</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>Finalize brand identity</li>
              <li>Approve website content</li>
              <li>Prepare launch promotions</li>
            </ul>
          </section>
        </aside>
      </div>
    </WorkspaceLayout>
  );
}

export default function WorkspaceDemo() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <WorkspaceDemoContent />
    </Suspense>
  );
}
