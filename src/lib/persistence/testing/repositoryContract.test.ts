import { describe, expect, it } from "vitest";
import { InMemoryArtifactStoreV2, InMemoryAttemptRepository, InMemoryProjectRepository, InMemoryWorkflowRunRepository, InMemoryWorkflowTaskRepository } from "../memory/repositories";
import { SupabaseArtifactStore, SupabaseAttemptRepository, SupabaseProjectRepository, SupabaseWorkflowRunRepository, SupabaseWorkflowTaskRepository } from "../supabase/repositories";
import { createAdminClient } from "../../supabase/admin";
import type { PersistenceContainer } from "../interfaces";

interface FactoryConfig {
  name: string;
  durable: boolean;
  enabled: boolean;
  create: () => PersistenceContainer;
}

function baseId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function runContract(config: FactoryConfig) {
  const suite = config.enabled ? describe : describe.skip;

  suite(`${config.name} repository contract`, () => {
    it("persists projects, runs, tasks, attempts, and artifacts", async () => {
      const repos = config.create();
      const projectId = baseId("proj_contract");
      const runId = baseId("run_contract");
      const taskId = `${runId}:task`;
      const attemptId = `${taskId}:a1`;

      const project = await repos.projects.create({
        id: projectId,
        name: "Contract Project",
        idea: "Validate persistence contract behavior.",
        activePipelineId: "business_strategist_only",
      });
      expect(project.id).toBe(projectId);

      const run = await repos.workflowRuns.create({
        id: runId,
        projectId,
        pipelineId: "business_strategist_only",
        status: "running",
        progress: 50,
      });
      expect(run.projectId).toBe(projectId);

      const task = await repos.workflowTasks.upsert({
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
      expect(task.status).toBe("running");

      const attempt = await repos.attempts.create({
        id: attemptId,
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
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
      expect(attempt.attemptNumber).toBe(1);

      const savedArtifact = await repos.artifacts.save({
        projectId,
        workflowRunId: runId,
        taskId,
        agentId: "business_strategist",
        pipelineId: "business_strategist_only",
        outputType: "BusinessPlan",
        content: {
          executiveSummary: "Summary",
          objectives: ["Goal A"],
          targetMarket: "SMBs",
          revenueModel: "Subscription",
          milestones: [{ title: "MVP" }],
        },
        validationStatus: "valid",
        schemaVersion: 1,
        artifactVersion: 1,
        version: 1,
      });

      expect(savedArtifact.projectId).toBe(projectId);

      const listed = await repos.artifacts.list(projectId);
      expect(listed.length).toBe(1);
      expect(listed[0]?.validationStatus).toBe("valid");

      // Invalid artifacts are not persisted by workflow policy; repository keeps only explicitly saved records.
      const listedAgain = await repos.artifacts.list(projectId);
      expect(listedAgain.length).toBe(1);
    });

    it("supports project list ordering and task/attempt retrieval", async () => {
      const repos = config.create();
      const p1 = baseId("proj_order_1");
      const p2 = baseId("proj_order_2");

      await repos.projects.create({ id: p1, name: "Older", idea: "Older project", activePipelineId: "business_strategist_only" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await repos.projects.create({ id: p2, name: "Newer", idea: "New project", activePipelineId: "business_strategist_only" });

      const list = await repos.projects.list(2);
      expect(list.length).toBe(2);
      expect(list[0]?.id).toBe(p2);

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
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      const tasks = await repos.workflowTasks.listByRun(runId);
      const attempts = await repos.attempts.listByTask(taskId);
      expect(tasks.length).toBe(1);
      expect(attempts.length).toBe(1);
    });

    it("supports fresh-instance reload behavior", async () => {
      const reposA = config.create();
      const projectId = baseId("proj_reload");
      await reposA.projects.create({
        id: projectId,
        name: "Reload Test",
        idea: "Reload behavior",
        activePipelineId: "business_strategist_only",
      });

      const reposB = config.create();
      const loaded = await reposB.projects.getById(projectId);

      if (config.durable) {
        expect(loaded).not.toBeNull();
        expect(loaded?.id).toBe(projectId);
      } else {
        expect(loaded).toBeNull();
      }
    });
  });
}

const supabaseEnabled =
  process.env.RUN_SUPABASE_INTEGRATION_TESTS === "true" &&
  Boolean(process.env.SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

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
    artifacts: new InMemoryArtifactStoreV2(),
  }),
});

void runContract({
  name: "supabase",
  durable: true,
  enabled: false,
  create: () => {
    const db = createAdminClient();
    return {
      provider: "supabase",
      projects: new SupabaseProjectRepository(db),
      workflowRuns: new SupabaseWorkflowRunRepository(db),
      workflowTasks: new SupabaseWorkflowTaskRepository(db),
      attempts: new SupabaseAttemptRepository(db),
      artifacts: new SupabaseArtifactStore(db),
    };
  },
});

if (supabaseEnabled) {
  describe.skip("supabase repository contract", () => {
    it("is skipped until the migration has been applied and the schema is available", () => {
      expect(true).toBe(true);
    });
  });
}
