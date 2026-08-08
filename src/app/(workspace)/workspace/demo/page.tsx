"use client";

import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type MonetaryValue = {
  amount: number;
  currency: string;
  period?: "one_time" | "monthly" | "annual";
};

type ProjectStatusResponse = {
  projectId: string;
  name: string;
  idea: string;
  status: "queued" | "running" | "completed" | "failed";
  workflowStatus?: string | null;
  pausedTaskId?: string | null;
  userInputRequest?: { requestId: string; question: string; requiredFields: Array<{ key: string; label: string; type: string; required: boolean }>; createdAt: string } | null;
  capabilities?: Array<{
    id: string;
    displayName: string;
    status: "available" | "generated" | "selected_but_not_available" | "coming_soon" | "failed" | "blocked" | "not_selected";
  }>;
  errorMessage: string | null;
  businessPlan: BusinessPlan | null;
  marketResearchReport: Record<string, unknown> | null;
  financialModel: Record<string, unknown> | null;
  projectScore?: {
    overallScore: number | null;
    notEnoughData: boolean;
    calculationExplanation: string;
    dimensions: Array<{
      id: string;
      score: number;
      weight: number;
      weightedScore: number;
      explanation: string;
      missingInputs: string[];
      improvementActions: string[];
      confidence: number;
    }>;
    confidenceLevel: number;
  } | null;
};

type BusinessPlan = {
  executiveSummary: string;
  objectives?: Array<{ statement?: string } | string>;
  targetMarket?: string;
  revenueModel?: string;
  milestones?: Array<{ title: string; dueDate?: string; targetDate?: string }>;
  businessVertical?: string;
};

function formatMoney(value: unknown) {
  if (typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "-";
  const money = value as MonetaryValue;
  const amount = typeof money.amount === "number" ? money.amount : null;
  const currency = typeof money.currency === "string" ? money.currency : null;
  const period = typeof money.period === "string" ? money.period : null;
  if (amount === null || !currency) return "-";
  return `${currency} ${amount.toLocaleString()}${period ? ` / ${period}` : ""}`;
}

function financialTotalFromLineItems(items: unknown, fallback: number | null = null) {
  if (Array.isArray(items)) {
    let currency: string | null = null;
    const amount = items.reduce((sum, line) => {
      const value = (line as { value?: MonetaryValue }).value;
      if (!currency && typeof value?.currency === "string") {
        currency = value.currency;
      }
      return typeof value?.amount === "number" ? sum + value.amount : sum;
    }, 0);

    if (items.length > 0) {
      return {
        amount,
        currency,
      };
    }
  }

  if (typeof fallback === "number") {
    return {
      amount: fallback,
      currency: null,
    };
  }

  return null;
}

function formatAggregatedMoney(total: { amount: number; currency: string | null } | null, fallbackCurrency?: string | null) {
  if (!total) return "Unavailable";
  const currency = total.currency ?? fallbackCurrency ?? null;
  if (!currency) return "Currency unresolved";
  return `${currency} ${total.amount.toLocaleString()}`;
}

function financialTotalFromLegacyField(value: unknown) {
  if (typeof value === "number") {
    return {
      amount: value,
      currency: null,
    };
  }
  return null;
}

function mergeTotals(
  primary: { amount: number; currency: string | null } | null,
  secondary: { amount: number; currency: string | null } | null,
) {
  return primary ?? secondary;
}

function resolveFinancialCurrency(financialModel: Record<string, unknown> | null) {
  if (!financialModel) return null;
  const startupCosts = (financialModel.startupCosts as Array<{ value?: MonetaryValue }> | undefined) ?? [];
  const operatingCosts = (financialModel.operatingCosts as Array<{ value?: MonetaryValue }> | undefined) ?? [];
  const fromStartup = startupCosts.find((line) => typeof line.value?.currency === "string")?.value?.currency;
  if (fromStartup) return fromStartup;
  const fromOperating = operatingCosts.find((line) => typeof line.value?.currency === "string")?.value?.currency;
  if (fromOperating) return fromOperating;
  return null;
}

function WorkspaceDemoContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const [projectStatus, setProjectStatus] = useState<ProjectStatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const score = projectStatus?.projectScore?.overallScore ?? null;
  const hasEnoughScoreData = !(projectStatus?.projectScore?.notEnoughData ?? true);

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

  const businessPlan = (projectStatus?.businessPlan ?? null) as BusinessPlan | null;
  const marketResearch = projectStatus?.marketResearchReport ?? null;
  const financialModel = projectStatus?.financialModel ?? null;
  const milestones = businessPlan?.milestones ?? [];
  const financialCurrency = useMemo(() => resolveFinancialCurrency(financialModel), [financialModel]);

  const startupCostsTotal = useMemo(() => {
    if (!financialModel) return null;
    const startupCosts = (financialModel as { startupCosts?: unknown; startupCostsTotal?: number }).startupCosts;
    const legacy = (financialModel as { startupCosts?: { total?: number } }).startupCosts;
    return mergeTotals(
      financialTotalFromLineItems(startupCosts),
      financialTotalFromLegacyField(typeof legacy === "object" ? (legacy?.total ?? null) : null),
    );
  }, [financialModel]);

  const operatingCostsTotal = useMemo(() => {
    if (!financialModel) return null;
    const operatingCosts = (financialModel as { operatingCosts?: unknown; operatingCostsTotal?: number }).operatingCosts;
    const legacy = (financialModel as { operatingCosts?: { totalMonthly?: number } }).operatingCosts;
    return mergeTotals(
      financialTotalFromLineItems(operatingCosts),
      financialTotalFromLegacyField(typeof legacy === "object" ? (legacy?.totalMonthly ?? null) : null),
    );
  }, [financialModel]);

  const expectedForecast = useMemo(() => {
    const forecast = (financialModel as { financialForecast?: unknown } | null)?.financialForecast;
    if (Array.isArray(forecast)) {
      return forecast.find((item) => (item as { scenario?: string }).scenario === "expected") as Record<string, unknown> | undefined;
    }
    return (forecast as { expected?: Record<string, unknown> } | undefined)?.expected;
  }, [financialModel]);

  const recommendedNextSteps = (projectStatus?.capabilities ?? [])
    .filter((cap) => cap.status === "available" || cap.status === "blocked" || cap.status === "selected_but_not_available")
    .slice(0, 3)
    .map((cap) => `${cap.displayName} (${cap.status.replaceAll("_", " ")})`);

  return (
    <WorkspaceLayout project={projectStatus?.name ?? "Unnamed Project"} capabilities={projectStatus?.capabilities ?? []}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="col-span-2 space-y-6">
          <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Project Score</p>
                <h3 className="mt-2 text-3xl font-semibold text-white">{score === null ? "Not enough data to score" : score}</h3>
                <p className="mt-2 text-xs text-slate-400">{projectStatus?.projectScore?.calculationExplanation ?? "Score is explainable and derived from weighted dimensions."}</p>
              </div>
              <div className="text-sm text-slate-400">Execution Status: {projectStatus?.workflowStatus ?? projectStatus?.status ?? "queued"}</div>
            </div>
            <div className="mt-6 h-3 w-full rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400" style={{ width: `${score ?? 0}%` }} />
            </div>
            {hasEnoughScoreData && (projectStatus?.projectScore?.dimensions?.length ?? 0) > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {projectStatus?.projectScore?.dimensions?.slice(0, 4).map((dimension) => (
                  <div key={dimension.id} className="rounded-lg bg-slate-950/60 p-3 text-xs text-slate-300">
                    <p className="font-medium text-white">{dimension.id}</p>
                    <p className="mt-1">Score: {dimension.score}</p>
                    <p className="mt-1">Confidence: {Math.round(dimension.confidence * 100)}%</p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Business Plan</p>
            {!projectId ? <p className="mt-4 text-sm text-slate-400">No project selected.</p> : null}
            {loadError ? <p className="mt-4 text-sm text-rose-400">{loadError}</p> : null}
            {projectStatus?.status === "failed" && projectStatus.errorMessage ? <p className="mt-4 text-sm text-rose-400">{projectStatus.errorMessage}</p> : null}
            {businessPlan ? (
              <div className="mt-4 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Executive Summary</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">{businessPlan.executiveSummary}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-400">Target Market</p>
                    <p className="mt-2 text-sm font-medium text-white">{businessPlan.targetMarket ?? "Unavailable"}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-400">Revenue Model</p>
                    <p className="mt-2 text-sm font-medium text-white">{businessPlan.revenueModel ?? "Unavailable"}</p>
                  </div>
                </div>
                {businessPlan.businessVertical ? (
                  <div className="rounded-lg bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-400">Business Vertical</p>
                    <p className="mt-2 text-sm font-medium text-white">{businessPlan.businessVertical}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Objectives</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-200">
                    {(businessPlan.objectives ?? []).map((objective, index) => (
                      <li key={`${index}`} className="rounded-lg bg-slate-950/60 px-3 py-2">
                        {typeof objective === "string" ? objective : (objective.statement ?? "Objective")}
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
                        <li key={`${milestone.title}-${milestone.targetDate ?? milestone.dueDate ?? "none"}`} className="rounded-lg bg-slate-950/60 px-3 py-2">
                          {milestone.title}
                          {milestone.targetDate ? ` - ${milestone.targetDate}` : milestone.dueDate ? ` - ${milestone.dueDate}` : ""}
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

          <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Market Research Report</p>
            {marketResearch ? (
              <div className="mt-4 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Summary</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">{String((marketResearch as { summary?: unknown }).summary ?? "")}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-400">Market Size Estimate</p>
                    <p className="mt-2 text-sm font-medium text-white">{String((marketResearch as { marketSizeEstimate?: unknown }).marketSizeEstimate ?? "Unavailable")}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-400">Target Customers</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-200">
                      {((marketResearch as { targetCustomers?: string[] }).targetCustomers ?? []).map((segment) => (
                        <li key={segment}>{segment}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Trends</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-200">
                    {((marketResearch as { trends?: string[] }).trends ?? []).map((trend) => (
                      <li key={trend} className="rounded-lg bg-slate-950/60 px-3 py-2">
                        {trend}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Market Claims</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-200">
                    {((marketResearch as { claims?: Array<{ claimId: string; claim: string; validationStatus: string; confidence: number }> }).claims ?? []).map((claim) => (
                      <li key={claim.claimId} className="rounded-lg bg-slate-950/60 px-3 py-2">
                        <p>{claim.claim}</p>
                        <p className="mt-1 text-xs text-slate-400">{claim.validationStatus} · confidence {Math.round(claim.confidence * 100)}%</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Competitor Data</p>
                  {String((marketResearch as { competitorDataStatus?: unknown }).competitorDataStatus ?? "").toLowerCase() === "unavailable" ? (
                    <p className="mt-2 text-sm text-amber-300">Competitor data unavailable. External validation required.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-slate-200">
                      {((marketResearch as { competitors?: Array<{ name: string; validationStatus: string }> }).competitors ?? []).map((competitor) => (
                        <li key={competitor.name} className="rounded-lg bg-slate-950/60 px-3 py-2">
                          {competitor.name} · {competitor.validationStatus}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Market Research Report will appear here once execution completes.</p>
            )}
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Financial Model</p>
            {financialModel ? (
              <div className="mt-4 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-400">Startup Costs (Total)</p>
                    <p className="mt-2 text-sm font-medium text-white">{formatAggregatedMoney(startupCostsTotal, financialCurrency)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-400">Operating Costs (Monthly)</p>
                    <p className="mt-2 text-sm font-medium text-white">{formatAggregatedMoney(operatingCostsTotal, financialCurrency)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Revenue Model</p>
                  <p className="mt-2 text-sm font-medium text-white">{String((financialModel as { revenueModelType?: unknown }).revenueModelType ?? (financialModel as { revenueModel?: { type?: string } }).revenueModel?.type ?? "Unavailable")}</p>
                  <p className="mt-2 text-sm text-slate-300">{String((financialModel as { revenueModel?: { reasoning?: string } }).revenueModel?.reasoning ?? "")}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Pricing Recommendation</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-200">
                    {((financialModel as { pricingRecommendation?: Array<{ tier: string; recommendedPrice: unknown; targetCustomer: string }> }).pricingRecommendation ?? []).map((tier) => (
                      <li key={`${tier.tier}-${tier.targetCustomer}`} className="rounded-lg bg-slate-950/60 px-3 py-2">
                        <span className="font-medium text-white">{tier.tier}</span>
                        {` - ${formatMoney(tier.recommendedPrice)} (${tier.targetCustomer})`}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Forecast (Expected)</p>
                  <div className="mt-2 rounded-lg bg-slate-950/60 p-4 text-sm text-slate-200">
                    <p>Monthly Revenue: {formatMoney((expectedForecast as { monthlyRevenue?: unknown } | undefined)?.monthlyRevenue)}</p>
                    <p>Monthly Expenses: {formatMoney((expectedForecast as { monthlyExpenses?: unknown } | undefined)?.monthlyExpenses)}</p>
                    <p>Net Profit: {formatMoney((expectedForecast as { netProfit?: unknown } | undefined)?.netProfit)}</p>
                    <p>Estimated Customers: {String((expectedForecast as { estimatedCustomers?: unknown } | undefined)?.estimatedCustomers ?? "-")}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Funding Recommendation</p>
                  <p className="mt-2 text-sm font-medium text-white">{String((financialModel as { fundingRecommendation?: { type?: string } }).fundingRecommendation?.type ?? "Unavailable")}</p>
                  <p className="mt-2 text-sm text-slate-300">{String((financialModel as { fundingRecommendation?: { reasoning?: string } }).fundingRecommendation?.reasoning ?? "")}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Financial Model will appear here once execution completes.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.28em] text-brand-300">AI Progress</p>
            <p className="mt-3 text-sm text-slate-300">Current state: {projectStatus?.workflowStatus ?? projectStatus?.status ?? "queued"}</p>
            {projectStatus?.status === "queued" ? <p className="mt-2 text-sm text-slate-400">Queued</p> : null}
            {projectStatus?.status === "running" ? <p className="mt-2 text-sm text-slate-400">Running</p> : null}
            {projectStatus?.status === "completed" ? <p className="mt-2 text-sm text-emerald-300">Completed</p> : null}
            {projectStatus?.status === "failed" ? <p className="mt-2 text-sm text-rose-300">Failed</p> : null}
            {projectStatus?.workflowStatus === "waiting_for_user" ? (
              <div className="mt-2 space-y-1 text-xs text-amber-300">
                <p>Paused on: {projectStatus.pausedTaskId ?? "task"}</p>
                <p>{projectStatus.userInputRequest?.question ?? "Waiting for required user input."}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Recommended Next Steps</p>
            {recommendedNextSteps.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No immediate next steps. Continue by selecting additional goals in the project setup.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {recommendedNextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            )}
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
