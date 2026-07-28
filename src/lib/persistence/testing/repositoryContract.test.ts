import { describe, expect, it } from "vitest";
import { loadEnvConfig } from "@next/env";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  InMemoryArtifactStoreV2,
  InMemoryAttemptRepository,
  InMemoryProjectRepository,
  InMemoryWorkflowCheckpointRepository,
  InMemoryWorkflowRunRepository,
  InMemoryWorkflowTaskRepository,
} from "../memory/repositories";
import {
  SupabaseArtifactStore,
  SupabaseAttemptRepository,
  SupabaseProjectRepository,
  SupabaseWorkflowCheckpointRepository,
  SupabaseWorkflowRunRepository,
  SupabaseWorkflowTaskRepository,
} from "../supabase/repositories";
import { createAdminClient } from "../../supabase/admin";
import type { PersistenceContainer } from "../interfaces";

const requiredSupabaseEnvKeys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const fixedIso = "2026-08-10T12:00:00.000Z";

function parseDotEnvFile(filePath: string) {
  const values = new Map<string, string>();
  if (!existsSync(filePath)) return values;

  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    if (!key) continue;
    let raw = match[2] ?? "";

    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      raw = raw.slice(1, -1);
    } else {
      raw = raw.replace(/\s+#.*$/, "").trim();
    }

    values.set(key, raw);
  }

  return values;
}

function hydrateSupabaseEnvForTests() {
  loadEnvConfig(process.cwd(), true);

  const envPath = join(process.cwd(), ".env.local");
  const parsed = parseDotEnvFile(envPath);
  for (const key of requiredSupabaseEnvKeys) {
    const value = parsed.get(key);
    if (value) process.env[key] = value;
  }

  return requiredSupabaseEnvKeys.every((key) => Boolean(process.env[key]));
}

const supabaseEnabled = hydrateSupabaseEnvForTests();

interface FactoryConfig {
  name: string;
  durable: boolean;
  enabled: boolean;
  create: () => PersistenceContainer;
}

function baseId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function cleanupProjects(projectIds: string[]) {
  if (projectIds.length === 0 || !supabaseEnabled) return;
  const db = createAdminClient();
  await db.from("projects").delete().in("id", projectIds);
}

async function hasWorkflowCheckpointTable() {
  if (!supabaseEnabled) return false;
  const db = createAdminClient();
  const { error } = await db.from("workflow_checkpoints").select("workflow_run_id").limit(1);
  return !error;
}

async function runContract(config: FactoryConfig) {
  const suite = config.enabled ? describe : describe.skip;
  const durableTimeoutMs = config.durable ? 30000 : undefined;

  suite(`${config.name} repository contract`, () => {
    it(
      "persists projects, runs, tasks, attempts, artifacts, and checkpoints",
      async () => {
        const repos = config.create();
        const projectId = baseId("proj_contract");
        const runId = baseId("run_contract");
        const taskId = `${runId}:task_bs`;
        const marketTaskId = `${runId}:task_mr`;
        const financialTaskId = `${runId}:task_fa`;
        const createdProjectIds: string[] = [];

        try {
          const project = await repos.projects.create({
            id: projectId,
            name: "Contract Project",
            idea: "Validate persistence contract behavior.",
            activePipelineId: "business_strategist_only",
          });
          createdProjectIds.push(projectId);
          expect(project.id).toBe(projectId);

          const run = await repos.workflowRuns.create({
            id: runId,
            projectId,
            pipelineId: "business_strategist_only",
            status: "running",
            progress: 50,
          });
          expect(run.projectId).toBe(projectId);

          await repos.workflowTasks.upsert({
            id: taskId,
            workflowRunId: runId,
            projectId,
            agentId: "business_strategist",
            outputType: "BusinessPlan",
            providerId: "openai",
            model: "gpt-4o-mini",
            status: "running",
            dependencyIds: [],
          });

          await repos.workflowTasks.upsert({
            id: marketTaskId,
            workflowRunId: runId,
            projectId,
            agentId: "market_research",
            outputType: "MarketResearchReport",
            providerId: "openai",
            model: "gpt-4o-mini",
            status: "running",
            dependencyIds: [taskId],
          });

          await repos.workflowTasks.upsert({
            id: financialTaskId,
            workflowRunId: runId,
            projectId,
            agentId: "financial_analyst",
            outputType: "FinancialModel",
            providerId: "openai",
            model: "gpt-4o-mini",
            status: "running",
            dependencyIds: [taskId, marketTaskId],
          });

          await repos.attempts.create({
            id: `${taskId}:a1`,
            taskId,
            attemptNumber: 1,
            providerId: "openai",
            model: "gpt-4o-mini",
            status: "completed",
            errorCode: null,
            retryable: false,
            latencyMs: 1200,
            inputTokens: 100,
            outputTokens: 140,
            totalTokens: 240,
            startedAt: fixedIso,
            completedAt: fixedIso,
          });

          const savedBusinessPlan = await repos.artifacts.save({
            projectId,
            workflowRunId: runId,
            taskId,
            agentId: "business_strategist",
            pipelineId: "business_strategist_only",
            outputType: "BusinessPlan",
            content: {
              businessVertical: "restaurant_food_service",
              revenueModel: "transaction_sales",
              generatedAt: fixedIso,
              contextVersion: "1.0.0",
            },
            validationStatus: "valid",
            schemaVersion: 1,
            artifactVersion: 1,
            version: 1,
          });

          const savedMarket = await repos.artifacts.save({
            projectId,
            workflowRunId: runId,
            taskId: marketTaskId,
            agentId: "market_research",
            pipelineId: "business_strategist_only",
            outputType: "MarketResearchReport",
            content: {
              summary: "Market summary",
              competitorDataStatus: "unavailable",
              unavailableCompetitorOutcome: {
                competitorDataStatus: "unavailable",
                competitorCategoriesToInvestigate: ["quick_service_restaurants"],
                requiredResearchActions: ["Field mapping"],
                suggestedSearchQueries: ["healthy breakfast amman"],
                comparisonCriteria: ["price"],
              },
            },
            validationStatus: "valid",
            schemaVersion: 1,
            artifactVersion: 1,
            version: 1,
          });

          const savedFinancial = await repos.artifacts.save({
            projectId,
            workflowRunId: runId,
            taskId: financialTaskId,
            agentId: "financial_analyst",
            pipelineId: "business_strategist_only",
            outputType: "FinancialModel",
            content: {
              verticalId: "restaurant_food_service",
              revenueModelType: "transaction_sales",
              generatedAt: fixedIso,
            },
            validationStatus: "valid",
            schemaVersion: 1,
            artifactVersion: 1,
            version: 1,
          });

          expect(savedBusinessPlan.projectId).toBe(projectId);
          expect(savedMarket.projectId).toBe(projectId);
          expect(savedFinancial.projectId).toBe(projectId);

          const listed = await repos.artifacts.list(projectId);
          expect(listed.length).toBe(3);
          expect(listed.every((item) => item.validationStatus === "valid")).toBe(true);

          const shouldAssertCheckpoints = !config.durable || (await hasWorkflowCheckpointTable());
          if (shouldAssertCheckpoints) {
            const checkpoint = await repos.checkpoints.upsert({
              workflowRunId: runId,
              projectId,
              currentTaskId: marketTaskId,
              workflowStatus: "waiting_for_user",
              taskStatus: "waiting_for_user",
              completedTaskIds: [taskId],
              pendingTaskIds: [marketTaskId, financialTaskId],
              dependencyState: {
                [taskId]: [],
                [marketTaskId]: [taskId],
                [financialTaskId]: [taskId, marketTaskId],
              },
              attemptCounters: {
                [marketTaskId]: 1,
              },
              executionContext: {
                projectIdea: "Validate checkpoint",
              },
              userInputRequest: {
                requestId: "req_contract",
                workflowRunId: runId,
                taskId: marketTaskId,
                agentId: "market_research",
                question: "Please provide target market detail",
                context: "Need extra details",
                requiredFields: [{ key: "additionalContext", label: "Additional Context", type: "textarea", required: true }],
                createdAt: fixedIso,
              },
              requestId: "req_contract",
              checkpointVersion: 1,
              requestConsumedAt: null,
            });

            expect(checkpoint.workflowStatus).toBe("waiting_for_user");

            const consumed = await repos.checkpoints.consumeRequest({
              workflowRunId: runId,
              requestId: "req_contract",
              checkpointVersion: 1,
            });

            expect(consumed).not.toBeNull();
            expect(consumed?.requestConsumedAt).not.toBeNull();
          }
        } finally {
          if (config.durable) await cleanupProjects(createdProjectIds);
        }
      },
      durableTimeoutMs,
    );

    it(
      "supports project list ordering and task/attempt retrieval",
      async () => {
        const repos = config.create();
        const p1 = baseId("proj_order_1");
        const p2 = baseId("proj_order_2");
        const createdProjectIds: string[] = [];

        try {
          await repos.projects.create({ id: p1, name: "Older", idea: "Older project", activePipelineId: "business_strategist_only" });
          createdProjectIds.push(p1);
          await repos.projects.create({ id: p2, name: "Newer", idea: "New project", activePipelineId: "business_strategist_only" });
          createdProjectIds.push(p2);

          const list = await repos.projects.list(2);
          expect(list.length).toBe(2);

          const runId = baseId("run_order");
          const taskId = `${runId}:task`;
          await repos.workflowRuns.create({ id: runId, projectId: p2, pipelineId: "business_strategist_only", status: "running", progress: 0 });
          await repos.workflowTasks.upsert({
            id: taskId,
            workflowRunId: runId,
            projectId: p2,
            agentId: "business_strategist",
            status: "running",
          });

          await repos.attempts.create({
            id: `${taskId}:a1`,
            taskId,
            attemptNumber: 1,
            providerId: null,
            model: null,
            status: "failed",
            errorCode: "OPENAI_TIMEOUT",
            retryable: true,
            latencyMs: null,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            startedAt: fixedIso,
            completedAt: fixedIso,
          });

          const tasks = await repos.workflowTasks.listByRun(runId);
          const attempts = await repos.attempts.listByTask(taskId);
          expect(tasks.length).toBe(1);
          expect(attempts.length).toBe(1);
        } finally {
          if (config.durable) await cleanupProjects(createdProjectIds);
        }
      },
      durableTimeoutMs,
    );

    it(
      "supports fresh-instance reload behavior",
      async () => {
        const reposA = config.create();
        const projectId = baseId("proj_reload");
        const createdProjectIds: string[] = [];

        try {
          await reposA.projects.create({
            id: projectId,
            name: "Reload Test",
            idea: "Reload behavior",
            activePipelineId: "business_strategist_only",
          });
          createdProjectIds.push(projectId);

          const reposB = config.create();
          const loaded = await reposB.projects.getById(projectId);

          if (config.durable) {
            expect(loaded).not.toBeNull();
            expect(loaded?.id).toBe(projectId);
          } else {
            expect(loaded).toBeNull();
          }
        } finally {
          if (config.durable) await cleanupProjects(createdProjectIds);
        }
      },
      durableTimeoutMs,
    );

    it(
      "preserves deterministic generated dates and context fields across reload",
      async () => {
        if (!config.durable) return;

        const projectId = baseId("proj_restart_ctx");
        const runId = baseId("run_restart_ctx");
        const createdProjectIds = [projectId];

        try {
          const reposA = config.create();
          await reposA.projects.create({
            id: projectId,
            name: "Eggreen",
            idea: "Restart persistence verification",
            activePipelineId: "ceo_orchestrated",
            metadata: {
              businessName: "Eggreen",
              industry: "Restaurant & Food",
              country: "Jordan",
              currency: "JOD",
            },
          });

          await reposA.workflowRuns.create({
            id: runId,
            projectId,
            pipelineId: "ceo_orchestrated",
            status: "completed",
            progress: 100,
          });

          await reposA.artifacts.save({
            projectId,
            workflowRunId: runId,
            agentId: "business_strategist",
            outputType: "BusinessPlan",
            content: {
              businessName: "Eggreen",
              businessVertical: "restaurant_food_service",
              revenueModel: "transaction_sales",
              generatedAt: fixedIso,
              contextVersion: "1.0.0",
            },
            validationStatus: "valid",
            version: 1,
            schemaVersion: 1,
            artifactVersion: 1,
          });

          await reposA.artifacts.save({
            projectId,
            workflowRunId: runId,
            agentId: "financial_analyst",
            outputType: "FinancialModel",
            content: {
              revenueModelType: "transaction_sales",
              currency: "JOD",
              generatedAt: fixedIso,
              contextVersion: "1.0.0",
            },
            validationStatus: "valid",
            version: 1,
            schemaVersion: 1,
            artifactVersion: 1,
          });

          const reposB = config.create();
          const reloaded = await reposB.projects.getById(projectId);
          expect(reloaded?.name).toBe("Eggreen");

          const artifactsB = await reposB.artifacts.list(projectId);
          const plan = artifactsB.find((item) => item.outputType === "BusinessPlan");
          const financial = artifactsB.find((item) => item.outputType === "FinancialModel");

          expect((plan?.content as { businessVertical?: string } | undefined)?.businessVertical).toBe("restaurant_food_service");
          expect((plan?.content as { revenueModel?: string } | undefined)?.revenueModel).toBe("transaction_sales");
          expect((financial?.content as { currency?: string } | undefined)?.currency).toBe("JOD");
          expect((financial?.content as { generatedAt?: string } | undefined)?.generatedAt).toBe(fixedIso);
        } finally {
          await cleanupProjects(createdProjectIds);
        }
      },
      durableTimeoutMs,
    );
  });
}

void runContract({
  name: "memory",
  durable: false,
  enabled: true,
  create: () => ({
    provider: "memory",
    projects: new InMemoryProjectRepository(),
    workflowRuns: new InMemoryWorkflowRunRepository(),
    workflowTasks: new InMemoryWorkflowTaskRepository(),
    attempts: new InMemoryAttemptRepository(),
    checkpoints: new InMemoryWorkflowCheckpointRepository(),
    artifacts: new InMemoryArtifactStoreV2(),
  }),
});

void runContract({
  name: "supabase",
  durable: true,
  enabled: supabaseEnabled,
  create: () => {
    const db = createAdminClient();
    return {
      provider: "supabase",
      projects: new SupabaseProjectRepository(db),
      workflowRuns: new SupabaseWorkflowRunRepository(db),
      workflowTasks: new SupabaseWorkflowTaskRepository(db),
      attempts: new SupabaseAttemptRepository(db),
      checkpoints: new SupabaseWorkflowCheckpointRepository(db),
      artifacts: new SupabaseArtifactStore(db),
    };
  },
});
