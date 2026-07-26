import { AgentDefinition, AgentID, AgentRunResult, AgentStatus } from "./types/agents";
import { Pipeline, PipelineStep } from "./pipelines/pipelines";
import { logError, logInfo } from "./utils/logger";
import { validateModel } from "./validation/validator";
import { makeError, AiError } from "./errors/errors";
import { globalProviderManager } from "./providers/manager";
import defaultModels, { type ModelConfig } from "./providers/models";
import { globalArtifactStore } from "./store/setup";
import { normalizeProviderResponse } from "./normalization/normalizer";
import { promptTemplates, renderPrompt } from "./prompts/prompts";
import { OpenAIProviderError } from "./providers/openaiProvider";

export type AttemptRecord = {
  attempt: number;
  timestamp: string;
  rawOutput: unknown;
  validation?: { success: boolean; errors?: unknown };
  error?: AiError;
};

type ProviderInvocationResult = {
  providerId?: string;
  requestId?: string | null;
  metadata?: {
    startedAt?: string;
    completedAt?: string;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export type TaskRecord = {
  id: string;
  step: PipelineStep;
  status: AgentStatus;
  result?: AgentRunResult;
  attempts: AttemptRecord[];
  maxRetries: number;
};

export interface OrchestratorHooks {
  onTaskChanged?: (task: TaskRecord) => Promise<void> | void;
  onAttemptRecorded?: (task: TaskRecord, attempt: AttemptRecord) => Promise<void> | void;
}

export class Orchestrator {
  pipelines: Pipeline[];
  agents: AgentDefinition[];
  tasks: Map<string, TaskRecord> = new Map();
  private mockResponses: Map<string, unknown[]> = new Map();
  private models: Record<string, ModelConfig>;
  private hooks: OrchestratorHooks;

  constructor(pipelines: Pipeline[], agents: AgentDefinition[], models: Record<string, ModelConfig> = defaultModels, hooks: OrchestratorHooks = {}) {
    this.pipelines = pipelines;
    this.agents = agents;
    this.models = models;
    this.hooks = hooks;
  }

  startPipeline(pipelineId: string, projectId: string, input?: Record<string, unknown>, workflowRunId?: string) {
    const pipeline = this.pipelines.find((p) => p.id === pipelineId);
    if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`);

    logInfo(`Starting pipeline ${pipelineId} for project ${projectId}`);
    return this.runStepsSequentially(pipeline, projectId, input, workflowRunId);
  }

  private async runStepsSequentially(pipeline: Pipeline, projectId: string, input?: Record<string, unknown>, workflowRunId?: string) {
    for (const step of pipeline.steps) {
      const taskId = `${pipeline.id}:${step.id}`;
      this.tasks.set(taskId, { id: taskId, step, status: AgentStatus.Running, attempts: [], maxRetries: 2 });
      await this.emitTaskChanged(taskId);
      try {
        const result = await this.runAgent(step, pipeline.id, taskId, projectId, input, workflowRunId);
        // update task with result and attempts
        const record = this.tasks.get(taskId)!;
        record.result = result;
        record.status = result.success ? AgentStatus.Completed : AgentStatus.Failed;
        this.tasks.set(taskId, record);
        await this.emitTaskChanged(taskId);
        logInfo(`Step ${step.id} finished`, { success: result.success });
        if (!result.success) {
          logError(`Agent ${step.agent} failed`, { error: result.error });
          break;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const record = this.tasks.get(taskId)!;
        record.status = AgentStatus.Failed;
        record.result = { agentId: step.agent, success: false, error: message };
        this.tasks.set(taskId, record);
        await this.emitTaskChanged(taskId);
        logError(`Unhandled error running step ${step.id}`, { error: message });
        break;
      }
    }

    return Array.from(this.tasks.values());
  }

  /**
   * Run an agent step. Uses registered mock responses when available.
   */
  private async runAgent(
    step: PipelineStep,
    pipelineId?: string,
    taskId?: string,
    projectId?: string,
    input?: Record<string, unknown>,
    workflowRunId?: string,
  ): Promise<AgentRunResult> {
    // Architecture-only: no AI calls. Placeholder to plug providers later.
    // Locate agent definition for metadata only.
    const agent = this.agents.find((a) => a.id === step.agent);
    const agentId = agent?.id ?? step.agent;
    const record = this.tasks.get(taskId ?? "")!;
    const maxRetries = record?.maxRetries ?? 2;

    // determine model config for this agent
    const modelCfg = this.models[step.agent];
    const providerId = modelCfg?.provider ?? (process.env.AI_PROVIDER_DEFAULT ?? "mock");

    const provider = globalProviderManager.get(providerId);
    const promptInput = this.buildPrompt(agentId as import("./types/agents").AgentID, input);
    const defaultInput = JSON.stringify({ projectId, input });
    const providerPrompt = promptInput ?? defaultInput;

    const queue = this.mockResponses.get(agentId) ?? [];

    if (queue.length === 0 && !provider && providerId !== "mock") {
      const err = makeError({
        code: "AGENT_EXECUTION_FAILED",
        message: `Provider '${providerId}' is not registered or not available.`,
        agentId,
        pipelineId,
        taskId,
        retryable: false,
      });
      return { agentId, success: false, error: err.message };
    }

    let providerResult: ProviderInvocationResult | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attemptRecord: AttemptRecord = { attempt, timestamp: new Date().toISOString(), rawOutput: null };
      let parsed: unknown;

      if (queue.length > 0) {
        const queued = queue.shift();
        attemptRecord.rawOutput = queued;
        if (typeof queued === "string") {
          try {
            parsed = JSON.parse(queued);
          } catch {
            parsed = queued;
          }
        } else {
          parsed = queued;
        }
        providerResult = queued as ProviderInvocationResult;
      } else if (provider) {
        try {
          const invokeRes = await provider.invoke(providerPrompt, {
            model: modelCfg?.model,
            temperature: modelCfg?.temperature,
            maxTokens: modelCfg?.maxTokens,
            timeoutMs: modelCfg?.timeoutMs,
            outputModel: agent?.outputModel,
            agentId,
          });
          providerResult = invokeRes as ProviderInvocationResult;
          parsed = normalizeProviderResponse(invokeRes);
          attemptRecord.rawOutput = invokeRes;
        } catch (e: unknown) {
          const isOpenAIError = e instanceof OpenAIProviderError;
          const err = makeError({
            code: "AGENT_EXECUTION_FAILED",
            message: isOpenAIError ? e.message : String(e instanceof Error ? e.message : e),
            agentId,
            pipelineId,
            taskId,
            retryable: isOpenAIError ? e.retryable : true,
            details: isOpenAIError
              ? { providerCode: e.code, providerId: e.providerId, model: e.model }
              : undefined,
          });
          attemptRecord.error = err;
          record.attempts.push(attemptRecord);
          this.tasks.set(taskId ?? "", record);
          await this.emitAttemptRecorded(taskId ?? "", attemptRecord);
          if (attempt < maxRetries && isOpenAIError && e.retryable) continue;
          if (attempt < maxRetries && !isOpenAIError) continue;
          return { agentId, success: false, error: err.message };
        }
      } else {
        const raw = providerPrompt;
        attemptRecord.rawOutput = raw;
        parsed = normalizeProviderResponse(raw);
      }

      // if agent declares an output model, validate
      if (agent?.outputModel) {
        const validation = validateModel(agent.outputModel, parsed);
        attemptRecord.validation = validation.success ? { success: true } : { success: false, errors: validation.errors };
        record.attempts.push(attemptRecord);
        this.tasks.set(taskId ?? "", record);
        await this.emitAttemptRecorded(taskId ?? "", attemptRecord);

        if (validation.success) {
          const saved = await globalArtifactStore.save({
            projectId: projectId ?? "unknown",
            workflowRunId,
            taskId,
            agentId,
            pipelineId: pipelineId ?? "",
            outputType: agent.outputModel,
            content: validation.value,
            version: 1,
            artifactVersion: 1,
            schemaVersion: 1,
            validationStatus: "valid",
          });
          return {
            agentId,
            success: true,
            output: validation.value,
            metadata: {
              providerId: providerResult?.providerId ?? provider?.id ?? "mock",
              requestId: providerResult?.requestId ?? null,
              model: modelCfg?.model,
              startedAt: providerResult?.metadata?.startedAt ?? null,
              completedAt: providerResult?.metadata?.completedAt ?? null,
              artifactId: saved.artifactId,
              attemptNumber: attempt,
            },
            usage: providerResult?.usage,
          };
        }

        // create structured error
        const err = makeError({
          code: "SCHEMA_VALIDATION_FAILED",
          message: "Output did not match expected schema",
          agentId,
          pipelineId,
          taskId,
          retryable: false,
          details: { issues: validation.errors },
        });
        attemptRecord.error = err;
        // no retry for schema mismatch by default
        record.attempts[record.attempts.length - 1] = attemptRecord;
        this.tasks.set(taskId ?? "", record);
        return { agentId, success: false, error: err.message };
      }

      // if no expected model, accept raw
      record.attempts.push(attemptRecord);
      this.tasks.set(taskId ?? "", record);
      await this.emitAttemptRecorded(taskId ?? "", attemptRecord);
      return { agentId, success: true, output: parsed };
    }

    return { agentId, success: false, error: "Exceeded retries" };
  }

  registerMockResponse(agentId: string, response: unknown) {
    const queue = this.mockResponses.get(agentId) ?? [];
    queue.push(response);
    this.mockResponses.set(agentId, queue);
  }

  private buildPrompt(agentId: AgentID, input?: Record<string, unknown>) {
    const template = promptTemplates[agentId];
    if (!template) return input ? JSON.stringify(input) : undefined;
    if (agentId === "business_strategist") {
      const projectSummary = typeof input?.projectSummary === "string" ? input.projectSummary : JSON.stringify(input ?? {});
      return renderPrompt(template, { projectSummary });
    }
    return renderPrompt(template, { projectSummary: JSON.stringify(input ?? {}) });
  }

  getProgress() {
    const total = this.tasks.size;
    const completed = Array.from(this.tasks.values()).filter((t) => t.status === AgentStatus.Completed).length;
    return { total, completed, tasks: Array.from(this.tasks.values()) };
  }

  private async emitTaskChanged(taskId: string) {
    if (!this.hooks.onTaskChanged) return;
    const task = this.tasks.get(taskId);
    if (!task) return;
    await this.hooks.onTaskChanged(task);
  }

  private async emitAttemptRecorded(taskId: string, attempt: AttemptRecord) {
    if (!this.hooks.onAttemptRecorded) return;
    const task = this.tasks.get(taskId);
    if (!task) return;
    await this.hooks.onAttemptRecorded(task, attempt);
  }
}

export default Orchestrator;
