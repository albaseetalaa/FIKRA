"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ProjectStatusResponse = {
  projectId: string;
  status: "queued" | "running" | "completed" | "failed";
  errorMessage: string | null;
};

const steps: Array<{ key: ProjectStatusResponse["status"]; label: string }> = [
  { key: "queued", label: "Queued" },
  { key: "running", label: "Running" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
];

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const [status, setStatus] = useState<ProjectStatusResponse["status"]>("queued");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/projects/status/${encodeURIComponent(projectId)}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Could not fetch execution status.");
        }

        const payload = (await res.json()) as ProjectStatusResponse;
        if (stop) return;

        setStatus(payload.status);
        setErrorMessage(payload.errorMessage ?? null);

        if (payload.status === "completed") {
          router.push(`/workspace/demo?projectId=${encodeURIComponent(projectId)}`);
          return;
        }

        if (payload.status === "failed") return;

        window.setTimeout(poll, 800);
      } catch (error: unknown) {
        if (stop) return;
        setStatus("failed");
        setErrorMessage(error instanceof Error ? error.message : "Execution failed.");
      }
    };

    void poll();
    return () => {
      stop = true;
    };
  }, [projectId, router]);

  const activeIndex = Math.max(0, steps.findIndex((step) => step.key === status));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-20">
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/90 p-10 shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.32em] text-brand-300">AI Processing</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">Let Fikra build your business story.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            The system is synthesizing your brief and shaping the first strategy, brand, and launch plan automatically.
          </p>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
            {status !== "completed" ? (
              <>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Current stage</p>
                    <p className="mt-2 text-xl font-semibold text-white">{steps[activeIndex]?.label ?? "Queued"}</p>
                  </div>
                  <div className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-200">{status}</div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 via-cyan-400 to-slate-100 transition-all duration-200"
                    style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }}
                  />
                </div>
                <div className="mt-6 grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
                  {steps.map((step, index) => (
                    <div
                      key={step.key}
                      className={`rounded-2xl border p-4 ${index <= activeIndex ? "border-brand-500/30 bg-brand-500/10 text-white" : "border-white/10 bg-slate-950/70"}`}
                    >
                      <p className="font-medium">{step.label}</p>
                    </div>
                  ))}
                </div>
                {status === "failed" && errorMessage ? <p className="mt-6 text-sm text-rose-400">{errorMessage}</p> : null}
              </>
            ) : (
              <div className="relative overflow-hidden rounded-[1.75rem] border border-brand-400/20 bg-gradient-to-br from-brand-700/15 via-slate-950/70 to-cyan-500/10 p-8 text-white shadow-[0_30px_90px_rgba(46,125,255,0.18)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(196,181,253,0.12),_transparent_35%)]" />
                <div className="relative flex flex-col items-start gap-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-brand-200 shadow-lg shadow-brand-500/20">
                    <svg viewBox="0 0 24 24" className="h-8 w-8 stroke-current" fill="none" strokeWidth="2">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" className="animate-check" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-brand-200/80">Workspace ready</p>
                    <h3 className="mt-3 text-3xl font-semibold text-white">Your workspace is ready.</h3>
                  </div>
                  <p className="text-sm text-slate-300">Redirecting to workspace...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateProjectProcessingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <ProcessingContent />
    </Suspense>
  );
}
