"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ProjectHistoryItem = {
  id: string;
  name: string;
  ideaExcerpt: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
};

export default function ProjectsHistoryPage() {
  const [items, setItems] = useState<ProjectHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/projects/history", { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load projects.");
        const payload = (await res.json()) as { items: ProjectHistoryItem[] };
        if (cancelled) return;
        setItems(payload.items ?? []);
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load projects.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-lg">
          <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Project History</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Previous Generated Projects</h1>
          <p className="mt-3 text-sm text-slate-400">Open any completed project to view the persisted Business Plan in workspace.</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          {loading ? <p className="text-sm text-slate-400">Loading projects...</p> : null}
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          {!loading && !error && items.length === 0 ? <p className="text-sm text-slate-400">No projects found yet.</p> : null}

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{item.name}</h2>
                    <p className="mt-1 text-sm text-slate-400">{item.ideaExcerpt}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200">{item.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <p>Created: {new Date(item.createdAt).toLocaleString()}</p>
                  <p>Updated: {new Date(item.updatedAt).toLocaleString()}</p>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/workspace/demo?projectId=${encodeURIComponent(item.id)}`}
                    className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
                  >
                    Open in Workspace
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
