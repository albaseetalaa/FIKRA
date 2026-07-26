export function HeroGraphic() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -left-10 -top-10 h-44 w-44 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-8 h-56 w-56 rounded-full bg-white/10 blur-3xl dark:bg-brand-500/20" />
      <div className="motion-safe:animate-float relative overflow-hidden rounded-[3rem] bg-slate-950/95 ring-1 ring-white/10 shadow-[0_50px_140px_rgba(15,23,42,0.22)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.18),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(52,211,153,0.12),_transparent_26%)]" />
        <div className="relative grid gap-6 p-8 sm:grid-cols-[1.2fr_0.95fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] bg-slate-900/85 p-5 ring-1 ring-white/10 backdrop-blur-xl">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-brand-200">Launch control</p>
                <h3 className="mt-3 text-xl font-semibold text-white">Fikra AI dashboard</h3>
              </div>
              <span className="inline-flex items-center rounded-full bg-brand-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-brand-200 ring-1 ring-white/10">
                Stable
              </span>
            </div>
            <div className="rounded-[2rem] bg-slate-900/90 p-6 ring-1 ring-white/10 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">Launch readiness</p>
                  <p className="mt-2 text-3xl font-semibold text-white">82%</p>
                </div>
                <div className="rounded-full bg-brand-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-brand-100">
                  AI insights
                </div>
              </div>
              <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-brand-400 to-brand-600" />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.75rem] bg-slate-950/80 p-4 text-sm text-slate-300 ring-1 ring-white/10">
                  <p className="font-semibold text-white">Design</p>
                  <p className="mt-2 text-xs text-slate-400">8 tasks left</p>
                </div>
                <div className="rounded-[1.75rem] bg-slate-950/80 p-4 text-sm text-slate-300 ring-1 ring-white/10">
                  <p className="font-semibold text-white">Website</p>
                  <p className="mt-2 text-xs text-slate-400">4 tasks left</p>
                </div>
                <div className="rounded-[1.75rem] bg-slate-950/80 p-4 text-sm text-slate-300 ring-1 ring-white/10">
                  <p className="font-semibold text-white">Launch</p>
                  <p className="mt-2 text-xs text-slate-400">2 days remaining</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[2rem] bg-slate-900/90 p-5 ring-1 ring-white/10">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Weekly growth</p>
                <p className="mt-3 text-2xl font-semibold text-white">4.8x</p>
                <p className="mt-2 text-sm text-slate-400">Conversion velocity improved</p>
              </div>
              <div className="rounded-[2rem] bg-slate-900/90 p-5 ring-1 ring-white/10">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">New leads</p>
                <p className="mt-3 text-2xl font-semibold text-white">1.2K</p>
                <p className="mt-2 text-sm text-slate-400">Pipeline ready for launch</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900/90 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-brand-500/15 to-transparent" />
            <div className="relative space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-3xl bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-brand-200">
                  Active project
                </div>
                <div className="rounded-full bg-slate-950/70 px-3 py-2 text-xs text-slate-300">ETA 2d</div>
              </div>
              <div className="space-y-4 rounded-[2rem] bg-slate-950/85 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Website launch</span>
                  <span className="font-semibold text-white">76%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-[76%] rounded-full bg-gradient-to-r from-brand-400 to-brand-600" />
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Brand asset kit", progress: 100 },
                  { label: "Landing page copy", progress: 88 },
                  { label: "Launch email flow", progress: 64 },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span>{item.label}</span>
                      <span className="text-slate-400">{item.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full rounded-full bg-brand-500`} style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
