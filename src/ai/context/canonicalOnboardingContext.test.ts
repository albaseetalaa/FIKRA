import { describe, expect, it, vi } from "vitest";
import { normalizeProjectContext } from "./projectContextNormalizer";
import { resolveCurrency } from "./currencyResolver";
import { findBudgetRangeOption, findLaunchTimelineOption } from "./budgetTimelineOptions";
import { buildAgentPrompt } from "../prompts/agentPromptBuilder";
import { sdkAgentDefinitions } from "../agents/sdkDefinitions";
import { executeAgentLifecycle } from "../sdk/lifecycle";
import { outputContracts } from "../sdk/outputContractRegistry";
import { InMemoryArtifactStore } from "../store/inMemoryStore";
import { ProviderManager } from "../providers/manager";
import type { AgentExecutionContext } from "../sdk/types";
import type { ProjectContext, ProjectContextInput } from "./types";

const baseInput: ProjectContextInput = {
  projectId: "proj_batch_a",
  businessName: "Eggreen",
  businessDescription: "Healthy egg-based breakfast restaurant with dine in and takeaway in Amman.",
  industry: "Restaurant & Food",
  businessStage: "Planning",
  country: "Jordan",
  city: "Amman",
  currency: null,
  targetAudience: "young professionals, families",
  customerAgeRange: "18-35",
  customerType: "Individuals",
  budgetRange: null,
  budgetCurrency: null,
  launchTimeline: null,
  selectedGoals: ["Build a brand identity", "Develop a business strategy", "Prepare a launch campaign"],
  projectCreatedAt: "2026-08-01T00:00:00.000Z",
  currentDate: "2026-08-01T00:00:00.000Z",
};

describe("Batch A: canonical onboarding and ProjectContext", () => {
  describe("A. new Jordan project with explicit currency, canonical budget, and 30-day timeline", () => {
    it("resolves currency, budget, and timeline deterministically with no currency token embedded in budgetRange", () => {
      const result = normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "under_5000",
        launchTimeline: "within_30_days",
      });

      expect(result.context.currency).toBe("JOD");
      expect(result.context.currencySource).toBe("user_selected");
      expect(result.context.budgetRange).toBe("under_5000");
      expect(result.context.budgetRange).not.toMatch(/SAR|JOD|USD|GBP|AED/);
      expect(result.context.launchTimelineDays).toBe(30);
      expect(result.status).toBe("valid");
    });

    it("the canonical budget option under_5000 carries no currency token and resolves a numeric ceiling", () => {
      const option = findBudgetRangeOption("under_5000");
      expect(option?.max).toBe(5000);
      expect(option?.label).not.toMatch(/SAR|JOD|USD/);
    });

    it("the canonical timeline option within_30_days resolves to exactly 30 days", () => {
      expect(findLaunchTimelineOption("within_30_days")?.days).toBe(30);
    });
  });

  describe("B. legacy conflict: Jordan country with no explicit currency and legacy SAR-labeled budget text", () => {
    it("resolves currency to JOD, not SAR, with a resolution source that identifies the legacy/country fallback", () => {
      const resolution = resolveCurrency({
        explicitCurrency: null,
        budgetCurrency: null,
        budgetRange: "Under SAR 5,000",
        country: "Jordan",
      });

      expect(resolution.currencyCode).toBe("JOD");
      expect(resolution.currencyCode).not.toBe("SAR");
      expect(resolution.resolutionSource).toBe("legacy_country_fallback");
    });

    it("produces the same result through the full normalization entry point", () => {
      const result = normalizeProjectContext({
        ...baseInput,
        currency: null,
        budgetRange: "Under SAR 5,000",
        launchTimeline: "Within 30 days",
      });

      expect(result.context.currency).toBe("JOD");
      expect(result.context.currencySource).toBe("legacy_country_fallback");
    });

    it("a legacy budget value that cannot be mapped to a canonical option leaves bounds unresolved rather than fabricated", () => {
      const result = normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "Under SAR 5,000",
        launchTimeline: "within_30_days",
      });

      expect(result.context.budgetMin).toBeNull();
      expect(result.context.budgetMax).toBeNull();
      expect(result.context.budgetRange).toBe("Under SAR 5,000");
      expect(result.validationNotes.some((note) => note.includes("budgetRange"))).toBe(true);
    });
  });

  describe("C. explicit currency overrides the country default", () => {
    it("USD wins over the Jordan country default", () => {
      const resolution = resolveCurrency({
        explicitCurrency: "USD",
        budgetCurrency: null,
        budgetRange: null,
        country: "Jordan",
      });

      expect(resolution.currencyCode).toBe("USD");
      expect(resolution.resolutionSource).toBe("user_selected");
    });

    it("through full normalization, explicit USD is not overwritten by the country default", () => {
      const result = normalizeProjectContext({
        ...baseInput,
        currency: "usd",
        budgetRange: "under_5000",
        launchTimeline: "within_30_days",
      });

      expect(result.context.currency).toBe("USD");
      expect(result.context.currencySource).toBe("user_selected");
    });
  });

  describe("D. every enabled agent's rendered common context includes currency, budget, and launch timeline in days", () => {
    const enabledAgents = sdkAgentDefinitions.filter((definition) => definition.enabled);

    it("at least the three known agents are enabled", () => {
      expect(enabledAgents.map((a) => a.id).sort()).toEqual(["business_strategist", "financial_analyst", "market_research"]);
    });

    const projectContext: ProjectContext = {
      ...normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "under_5000",
        launchTimeline: "within_30_days",
      }).context,
    };

    for (const agentId of ["business_strategist", "market_research", "financial_analyst"] as const) {
      it(`${agentId}'s rendered prompt includes currency, budget range, and launch timeline in days`, () => {
        const prompt = buildAgentPrompt({ agentId, projectContext });

        expect(prompt).toContain("Currency: JOD");
        expect(prompt).toContain("Budget range: under_5000");
        expect(prompt).toMatch(/Launch timeline: within_30_days \(30 days\)/);
      });
    }
  });

  describe("E. execution is blocked before provider invocation when required context is missing", () => {
    function makeExecutionContext(projectContext: ProjectContext, store: InMemoryArtifactStore): AgentExecutionContext {
      return {
        projectId: "proj-batch-a-block",
        workflowRunId: "run-batch-a-block",
        taskId: "run-batch-a-block:task-1",
        projectContext,
        currentDate: projectContext.currentDate,
        clock: {
          nowISO: () => "2026-08-01T00:00:00.000Z",
          nowMs: () => new Date("2026-08-01T00:00:00.000Z").getTime(),
        },
        upstreamArtifacts: {},
        selectedProviderId: "mock-provider",
        providerModel: "mock-model",
        outputTokenBudget: { initialOutputTokens: 1500, repairOutputTokens: 2100, maxOutputTokens: 2600 },
        attemptNumber: 1,
        repairAttemptNumber: 0,
        executionMode: "normal",
        trace: { pipelineId: "pipe-1", agentId: "business_strategist", correlationId: "corr-1" },
        persistence: { artifactStore: store },
        providerManager: new ProviderManager(),
        modelConfig: { provider: "mock-provider", model: "mock-model", maxTokens: 1500 },
        declaredCapabilities: ["external_api"],
      };
    }

    async function runWithContext(projectContext: ProjectContext) {
      const store = new InMemoryArtifactStore();
      const businessStrategist = sdkAgentDefinitions.find((d) => d.id === "business_strategist")!;
      const getProvider = vi.fn(() => ({ id: "mock-provider", invoke: vi.fn(async () => ({ output: {} })) }));

      const result = await executeAgentLifecycle({
        definitionPrompt: "prompt",
        outputContract: outputContracts.BusinessPlan,
        executionContext: makeExecutionContext(projectContext, store),
        requiredCapabilities: businessStrategist.requiredCapabilities,
        requiredProjectContextFields: businessStrategist.requiredProjectContextFields,
        supportedVerticals: businessStrategist.supportedVerticals,
        persistencePolicy: { persistInvalidAttempts: true, persistValidArtifactsOnly: true },
        maxTransportRetries: 1,
        maxRepairAttempts: 1,
        maxProviderCalls: 1,
        getProvider,
        model: "mock-model",
        timeoutMs: 100,
        buildRepairPrompt: (issues) => issues.join("\n"),
      });

      return { result, getProvider };
    }

    it("blocks when currency is missing, without ever invoking the provider", async () => {
      // country deliberately not in countryCurrencyMap and no explicit
      // currency: resolveCurrency has nothing to resolve from, so
      // currency genuinely stays unresolved here (unlike the other tests
      // in this file, which use "Jordan" and would otherwise resolve a
      // currency via the country fallback even with no explicit value).
      const context = normalizeProjectContext({
        ...baseInput,
        country: "Atlantis",
        currency: null,
        budgetRange: "under_5000",
        launchTimeline: "within_30_days",
      }).context;
      const { result, getProvider } = await runWithContext(context);

      expect(result.result.kind).toBe("non_retryable_failure");
      if (result.result.kind !== "success") {
        expect(result.result.message).toContain("currency");
      }
      expect(getProvider).not.toHaveBeenCalled();
    });

    it("blocks when budgetRange is missing, without ever invoking the provider", async () => {
      const context = normalizeProjectContext({ ...baseInput, currency: "JOD", budgetRange: null, launchTimeline: "within_30_days" }).context;
      const { result, getProvider } = await runWithContext(context);

      expect(result.result.kind).toBe("non_retryable_failure");
      if (result.result.kind !== "success") {
        expect(result.result.message).toContain("budgetRange");
      }
      expect(getProvider).not.toHaveBeenCalled();
    });

    it("blocks when launchTimelineMode is unresolved (unmappable legacy timeline text), without ever invoking the provider", async () => {
      const context = normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "under_5000",
        launchTimeline: "sometime next year maybe",
      }).context;
      const { result, getProvider } = await runWithContext(context);

      expect(result.result.kind).toBe("non_retryable_failure");
      if (result.result.kind !== "success") {
        expect(result.result.message).toContain("launchTimelineMode");
      }
      expect(getProvider).not.toHaveBeenCalled();
    });

    it("does not block when currency, budgetRange, and launchTimelineDays are all present", async () => {
      const context = normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "under_5000",
        launchTimeline: "within_30_days",
      }).context;
      const { getProvider } = await runWithContext(context);

      expect(getProvider).toHaveBeenCalled();
    });

    it("does not block on a null launchTimelineDays when launchTimelineMode is 'asap' — asap is a resolved, valid state with no day count", async () => {
      const context = normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "under_5000",
        launchTimeline: "asap",
      }).context;

      expect(context.launchTimelineMode).toBe("asap");
      expect(context.launchTimelineDays).toBeNull();

      const { getProvider } = await runWithContext(context);
      expect(getProvider).toHaveBeenCalled();
    });

    it("does not block on a null launchTimelineDays when launchTimelineMode is 'flexible' — flexible is a resolved, valid state with no day count", async () => {
      const context = normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "under_5000",
        launchTimeline: "flexible",
      }).context;

      expect(context.launchTimelineMode).toBe("flexible");
      expect(context.launchTimelineDays).toBeNull();

      const { getProvider } = await runWithContext(context);
      expect(getProvider).toHaveBeenCalled();
    });

    it("blocks a fixed-mode context whose launchTimelineDays was explicitly overridden to null, without ever invoking the provider", async () => {
      const context: ProjectContext = {
        ...normalizeProjectContext({
          ...baseInput,
          currency: "JOD",
          budgetRange: "under_5000",
          launchTimeline: "within_30_days",
        }).context,
        launchTimelineDays: null,
      };

      const { result, getProvider } = await runWithContext(context);

      expect(result.result.kind).toBe("non_retryable_failure");
      if (result.result.kind !== "success") {
        expect(result.result.message).toContain("launchTimelineDays");
      }
      expect(getProvider).not.toHaveBeenCalled();
    });
  });

  describe("F. canonical ProjectContext type safety and prompt phrasing", () => {
    it("normalizeProjectContext always populates budgetMin, budgetMax, launchTimelineMode, and launchTimelineDays as own properties, never omitted", () => {
      const result = normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "under_5000",
        launchTimeline: "within_30_days",
      });

      for (const field of ["budgetMin", "budgetMax", "launchTimelineMode", "launchTimelineDays"]) {
        expect(Object.prototype.hasOwnProperty.call(result.context, field)).toBe(true);
      }
    });

    it("an unresolved timeline still yields launchTimelineMode/launchTimelineDays as explicit nulls, not undefined", () => {
      const result = normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "under_5000",
        launchTimeline: null,
      });

      expect(result.context.launchTimelineMode).toBeNull();
      expect(result.context.launchTimelineDays).toBeNull();
    });

    it("renders 'no fixed day count' phrasing for asap and flexible, and the exact day count for a fixed timeline — never a fabricated value", () => {
      const asapContext = normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "under_5000",
        launchTimeline: "asap",
      }).context;
      const flexibleContext = normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "under_5000",
        launchTimeline: "flexible",
      }).context;
      const fixedContext = normalizeProjectContext({
        ...baseInput,
        currency: "JOD",
        budgetRange: "under_5000",
        launchTimeline: "within_6_months",
      }).context;

      const asapPrompt = buildAgentPrompt({ agentId: "business_strategist", projectContext: asapContext });
      const flexiblePrompt = buildAgentPrompt({ agentId: "business_strategist", projectContext: flexibleContext });
      const fixedPrompt = buildAgentPrompt({ agentId: "business_strategist", projectContext: fixedContext });

      expect(asapPrompt).toContain("Launch timeline: asap (As soon as possible; no fixed day count)");
      expect(flexiblePrompt).toContain("Launch timeline: flexible (Flexible; no fixed day count)");
      expect(fixedPrompt).toContain("Launch timeline: within_6_months (180 days)");
      expect(fixedPrompt).not.toContain("14 days");
      expect(fixedPrompt).not.toContain("365 days");
    });
  });
});
