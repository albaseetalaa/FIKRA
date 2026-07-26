import type { AIProvider, InvokeOptions } from "./interface";
import { OutputModelName } from "../types/outputs";

type StubMode = "valid" | "invalid" | "malformed" | "empty" | "timeout" | "rate_limit" | "error";

export interface StubOptions extends InvokeOptions {
  mode?: StubMode;
  agentId?: string;
  outputModel?: OutputModelName;
}

function nowISO() {
  return new Date().toISOString();
}

const StructuredStubProvider: AIProvider = {
  id: "structured-stub",
  name: "Structured Stub Provider",
  invoke: async (prompt: string, options?: StubOptions) => {
    const mode: StubMode = (options?.mode as StubMode) ?? (process.env.STRUCTURED_STUB_MODE as StubMode) ?? "valid";
    const agentId = options?.agentId as string | undefined;
    const outputModel = options?.outputModel as OutputModelName | undefined;

    // Simulate different failure modes
    if (mode === "timeout") {
      throw new Error("TIMEOUT");
    }
    if (mode === "rate_limit") {
      const error = new Error("RATE_LIMIT");
      (error as { code?: string }).code = "RATE_LIMIT";
      throw error;
    }
    if (mode === "error") {
      throw new Error("PROVIDER_ERROR");
    }

    // Build structured outputs for supported models
    const build = (model?: OutputModelName) => {
      switch (model) {
        case "BusinessPlan":
          return {
            executiveSummary: `${agentId ?? "Project"} is focused on fast laundry pickup and delivery for busy professionals.`,
            objectives: ["Launch MVP in 3 months", "Reach 1,000 weekly users by Q4"],
            targetMarket: "Urban professionals and families",
            revenueModel: "Subscription + per-order fees",
            milestones: [{ title: "MVP", dueDate: "2026-10-01" }],
          };
        case "MarketResearch":
          return {
            summary: "Market shows strong demand for convenience services in urban areas.",
            targetCustomers: ["Busy professionals", "Families"],
            marketSizeEstimate: "200M annual transactions",
            trends: ["On-demand services growth", "Subscription adoption"],
            competitors: ["Competitor A", "Competitor B"],
          };
        case "CompetitorAnalysis":
          return {
            competitor: "Competitor A",
            strengths: ["Wide coverage"],
            weaknesses: ["High prices"],
            opportunities: ["Better UX"],
          };
        case "FinancialReport":
          return {
            projectedRevenue: 1200000,
            projectedExpenses: 800000,
            cashflowSummary: "Positive after month 9",
          };
        case "BrandStrategy":
          return {
            positioning: "Convenience-first local laundry service",
            values: ["Reliable", "Fast", "Careful"],
            toneOfVoice: "Friendly and professional",
          };
        case "ProjectSummary":
          return { title: "QuickClean", description: "Laundry pickup & delivery for busy people.", createdAt: nowISO() };
        default:
          return { message: "unsupported" };
      }
    };

    if (mode === "malformed") {
      return "{ not: valid json }"; // malformed
    }

    if (mode === "empty") {
      return "";
    }

    if (mode === "invalid") {
      // Return an object that does not match schema
      return { bad: "data" };
    }

    // valid
    const payload = build(outputModel);
    // sometimes providers wrap responses in extra fields; emulate that
    return { id: "resp_1", created: Date.now(), result: { output: payload } };
  },
  stream: undefined,
  health: async () => ({ ok: true }),
  models: async () => ["BusinessPlan", "MarketResearch", "CompetitorAnalysis", "FinancialReport", "BrandStrategy", "ProjectSummary"],
  validateConfiguration: async () => true,
};

export default StructuredStubProvider;
