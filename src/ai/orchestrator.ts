import { AgentDefinition, AgentRunResult } from "./types/agents";
import type AIProvider from "./providers/interface";
import { Pipeline, PipelineStep } from "./pipelines/pipelines";
import { logError, logInfo } from "./utils/logger";
import { makeError, AiError } from "./errors/errors";
import { globalProviderManager } from "./providers/manager";
import defaultModels, { type ModelConfig } from "./providers/models";
import { globalArtifactStore } from "./store/setup";
import { TaskStateMachine, type TaskStatus } from "./workflow/stateMachine";
import type { ProjectContext } from "./context";
import { normalizeProjectContext } from "./context";
import type { ValidationDiagnostic } from "./validation/diagnostics";
import type { OutputModelName } from "./types/outputs";
import { getOutputBudgetByOutputModel } from "./providers/outputBudgets";
import { globalAgentFactory, globalAgentRegistry } from "./sdk/setup";
import type { AgentExecutionContext } from "./sdk";

export type AttemptRecord = {
  attempt: number;
  timestamp: string;
  rawOutput: unknown;
  validation?: { success: boolean; errors?: unknown };
  validationDiagnostic?: ValidationDiagnostic;
  error?: AiError;
};

export type TaskRecord = {
  id: string;
  step: PipelineStep;
  status: TaskStatus;
  result?: AgentRunResult;
  attempts: AttemptRecord[];
  maxRetries: number;
};

export interface OrchestratorHooks {
  onTaskChanged?: (task: TaskRecord) => Promise<void> | void;
  onAttemptRecorded?: (task: TaskRecord, attempt: AttemptRecord) => Promise<void> | void;
}

type OrchestratorOptions = {
  taskMaxRetries?: number;
};

type StartPipelineOptions = {
  initialStepOutputs?: Record<string, unknown>;
};

export class Orchestrator {
  pipelines: Pipeline[];
  agents: AgentDefinition[];
  tasks: Map<string, TaskRecord> = new Map();
  private mockResponses: Map<string, unknown[]> = new Map();
  private models: Record<string, ModelConfig>;
  private hooks: OrchestratorHooks;
  private taskMaxRetries: number;

  constructor(
    pipelines: Pipeline[],
    agents: AgentDefinition[],
    models: Record<string, ModelConfig> = defaultModels,
    hooks: OrchestratorHooks = {},
    options: OrchestratorOptions = {},
  ) {
    this.pipelines = pipelines;
    this.agents = agents;
    this.models = models;
    this.hooks = hooks;
    this.taskMaxRetries = Math.max(1, options.taskMaxRetries ?? 2);
  }

  startPipeline(
    pipelineOrId: string | Pipeline,
    projectId: string,
    input?: Record<string, unknown>,
    workflowRunId?: string,
    options: StartPipelineOptions = {},
  ) {
    const pipeline =
      typeof pipelineOrId === "string"
        ? this.pipelines.find((p) => p.id === pipelineOrId)
        : pipelineOrId;

    if (!pipeline) throw new Error(`Pipeline not found: ${String(pipelineOrId)}`);

    this.tasks.clear();
    logInfo(`Starting pipeline ${pipeline.id} for project ${projectId}`);
    return this.runStepsSequentially(pipeline, projectId, input, workflowRunId, options);
  }

  private async runStepsSequentially(
    pipeline: Pipeline,
    projectId: string,
    input?: Record<string, unknown>,
    workflowRunId?: string,
    options: StartPipelineOptions = {},
  ) {
    const stepOutputs = new Map<string, unknown>(Object.entries(options.initialStepOutputs ?? {}));

    for (const step of pipeline.steps) {
      const taskId = `${pipeline.id}:${step.id}`;
      const taskState = new TaskStateMachine("pending", taskId);
      this.tasks.set(taskId, { id: taskId, step, status: taskState.status, attempts: [], maxRetries: this.taskMaxRetries });
      taskState.transitionTo("ready");
      this.tasks.set(taskId, { ...(this.tasks.get(taskId)!), status: taskState.status });
      taskState.transitionTo("running");
      this.tasks.set(taskId, { ...(this.tasks.get(taskId)!), status: taskState.status });
      await this.emitTaskChanged(taskId);
      try {
        const dependencyIds = step.dependsOn ?? [];
        const dependencyOutputs = dependencyIds
          .map((dependencyId) => stepOutputs.get(dependencyId))
          .filter((value) => value !== undefined);

        const dependencyArtifactsByType: Record<string, unknown[]> = {};
        const dependencyArtifactsByAgent: Record<string, unknown[]> = {};

        for (const dependencyId of dependencyIds) {
          const dependencyOutput = stepOutputs.get(dependencyId);
          if (dependencyOutput === undefined) continue;

          const dependencyStep = pipeline.steps.find((item) => item.id === dependencyId);
          if (!dependencyStep) continue;

          const dependencyAgent = dependencyStep.agent;
          const dependencySdkDefinition = globalAgentRegistry.getById(dependencyAgent);
          const dependencyOutputType = dependencySdkDefinition?.outputArtifactType;

          dependencyArtifactsByAgent[dependencyAgent] = [
            ...(dependencyArtifactsByAgent[dependencyAgent] ?? []),
            dependencyOutput,
          ];

          if (dependencyOutputType) {
            dependencyArtifactsByType[dependencyOutputType] = [
              ...(dependencyArtifactsByType[dependencyOutputType] ?? []),
              dependencyOutput,
            ];
          }
        }

        const stepInput: Record<string, unknown> = {
          ...(input ?? {}),
          dependencyOutputs,
          dependencyArtifactsByType,
          dependencyArtifactsByAgent,
          upstreamArtifactsByType: dependencyArtifactsByType,
          upstreamArtifactsByAgent: dependencyArtifactsByAgent,
        };

        const result = await this.runAgent(step, pipeline.id, taskId, projectId, stepInput, workflowRunId);
        // update task with result and attempts
        const record = this.tasks.get(taskId)!;
        record.result = result;
        taskState.transitionTo(result.success ? "completed" : "failed");
        record.status = taskState.status;
        this.tasks.set(taskId, record);
        if (result.success && result.output !== undefined) {
          stepOutputs.set(step.id, result.output);
        }
        await this.emitTaskChanged(taskId);
        logInfo(`Step ${step.id} finished`, { success: result.success });
        if (!result.success) {
          logError(`Agent ${step.agent} failed`, { error: result.error });
          break;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const record = this.tasks.get(taskId)!;
        taskState.transitionTo("failed");
        record.status = taskState.status;
        record.result = { agentId: step.agent, success: false, error: message };
        this.tasks.set(taskId, record);
        await this.emitTaskChanged(taskId);
        logError(`Unhandled error running step ${step.id}`, { error: message });
        break;
      }
    }

    return Array.from(this.tasks.values());
  }

  private buildPersistedTaskId(taskId?: string, workflowRunId?: string) {
    if (!taskId) return undefined;
    if (!workflowRunId) return taskId;
    if (taskId.startsWith(`${workflowRunId}:`)) return taskId;
    return `${workflowRunId}:${taskId}`;
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
    // Locate agent definition for metadata only.
    const agent = this.agents.find((a) => a.id === step.agent);
    const agentId = agent?.id ?? step.agent;
    const record = this.tasks.get(taskId ?? "")!;
    const modelCfg = this.models[step.agent];
    const providerId = modelCfg?.provider ?? (process.env.AI_PROVIDER_DEFAULT ?? "mock");

    const provider = globalProviderManager.get(providerId);
    const normalizedInput = this.normalizeSdkInput(projectId ?? "unknown", input ?? {});

    const queue = this.mockResponses.get(agentId) ?? [];
    const sdkDefinition = globalAgentRegistry.getById(agentId as import("./types/agents").AgentID);

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

    const outputModel = (sdkDefinition?.outputArtifactType ?? agent?.outputModel) as OutputModelName | undefined;
    if (sdkDefinition && outputModel) {
      const providerAdapter = {
        id: provider?.id ?? providerId,
        invoke: async (prompt: string, options: Record<string, unknown>) => {
          if (queue.length > 0) {
            const queued = queue.shift();
            return {
              providerId: "mock-queue",
              model: modelCfg?.model,
              output: queued,
              metadata: {
                startedAt: undefined,
                completedAt: undefined,
                parsedJson: typeof queued !== "string",
                rawResponseAvailable: queued != null,
                rawResponseTruncated: false,
                refusalDetected: false,
                truncatedDetected: false,
              },
            };
          }

          if (!provider) {
            return {
              providerId: "prompt-fallback",
              model: modelCfg?.model,
              output: prompt,
              metadata: {
                startedAt: undefined,
                completedAt: undefined,
                parsedJson: false,
                rawResponseAvailable: true,
                rawResponseTruncated: false,
                refusalDetected: false,
                truncatedDetected: false,
              },
            };
          }

          return provider.invoke(prompt, options);
        },
      };

      const executionContext = this.buildExecutionContext({
        projectId,
        workflowRunId,
        taskId: this.buildPersistedTaskId(taskId, workflowRunId),
        pipelineId,
        agentId,
        modelCfg,
        input: normalizedInput,
        attemptNumber: 1,
        repairAttemptNumber: 0,
        executionMode: "normal",
      });

      const executable = globalAgentFactory.build(sdkDefinition, {
        providerId,
        model: modelCfg?.model ?? "unknown",
        pipelineId,
        getProvider: () => providerAdapter as unknown as AIProvider,
      });

      const lifecycle = await executable.execute(executionContext, normalizedInput);
      const sdkAttempts = (lifecycle as unknown as { attempts?: AttemptRecord[] }).attempts ?? [];
      for (const attempt of sdkAttempts) {
        record.attempts.push(attempt as AttemptRecord);
        await this.emitAttemptRecorded(taskId ?? "", attempt as AttemptRecord);
      }
      this.tasks.set(taskId ?? "", record);

      if (lifecycle.kind === "success") {
        return {
          agentId,
          success: true,
          output: lifecycle.output,
          metadata: {
            providerId,
            model: modelCfg?.model,
            artifactId: lifecycle.artifactId,
          },
        };
      }

      return {
        agentId,
        success: false,
        error: lifecycle.message,
      };
    }

    return {
      agentId,
      success: false,
      error: `Agent '${agentId}' is not registered in AgentRegistry with a supported output contract.`,
    };
  }

  private normalizeSdkInput(projectId: string, input: Record<string, unknown>) {
    if (input.projectContext && typeof input.projectContext === "object") {
      return input;
    }

    const nowIso = new Date().toISOString();
    const source = input;
    const normalized = normalizeProjectContext({
      projectId,
      businessName: typeof source.businessName === "string" && source.businessName.trim().length > 0
        ? source.businessName
        : "Unnamed Project",
      businessDescription: typeof source.projectIdea === "string" && source.projectIdea.trim().length > 0
        ? source.projectIdea
        : typeof source.projectSummary === "string" && source.projectSummary.trim().length > 0
          ? source.projectSummary
          : "User provided project request",
      industry: typeof source.industry === "string" && source.industry.trim().length > 0
        ? source.industry
        : "General",
      country: typeof source.country === "string" && source.country.trim().length > 0
        ? source.country
        : "Jordan",
      city: typeof source.city === "string" ? source.city : null,
      currency: typeof source.currency === "string" ? source.currency : null,
      targetAudience: typeof source.targetAudience === "string" ? source.targetAudience : null,
      customerType: typeof source.customerType === "string" ? source.customerType : null,
      customerAgeRange: typeof source.customerAgeRange === "string" ? source.customerAgeRange : null,
      businessStage: typeof source.businessStage === "string" ? source.businessStage : "planning",
      budgetRange: typeof source.budgetRange === "string" ? source.budgetRange : null,
      budgetCurrency: typeof source.budgetCurrency === "string" ? source.budgetCurrency : null,
      launchTimeline: typeof source.launchTimeline === "string" ? source.launchTimeline : null,
      selectedGoals: Array.isArray(source.selectedGoals)
        ? source.selectedGoals.filter((item): item is string => typeof item === "string")
        : [],
      currentDate: typeof source.currentDate === "string" ? source.currentDate : nowIso,
      projectCreatedAt: typeof source.projectCreatedAt === "string" ? source.projectCreatedAt : nowIso,
    });

    return {
      ...input,
      projectContext: normalized.context,
    };
  }

  private buildExecutionContext(params: {
    projectId?: string;
    workflowRunId?: string;
    taskId?: string;
    pipelineId?: string;
    agentId: string;
    modelCfg?: ModelConfig;
    input: Record<string, unknown>;
    attemptNumber: number;
    repairAttemptNumber: number;
    executionMode: "normal" | "repair" | "resume";
  }): AgentExecutionContext {
    const modelCfg = params.modelCfg;
    const sdkDefinition = globalAgentRegistry.getById(params.agentId as import("./types/agents").AgentID);
    const outputBudget = getOutputBudgetByOutputModel(
      this.agents.find((item) => item.id === params.agentId)?.outputModel as OutputModelName | undefined,
    );
    const projectContext = (params.input.projectContext as ProjectContext | undefined) ?? ({} as ProjectContext);

    return {
      projectId: params.projectId ?? "unknown",
      workflowRunId: params.workflowRunId,
      taskId: params.taskId,
      projectContext,
      currentDate: projectContext.currentDate ?? new Date().toISOString(),
      clock: {
        nowISO: () => new Date().toISOString(),
        nowMs: () => Date.now(),
      },
      upstreamArtifacts: params.input,
      selectedProviderId: modelCfg?.provider ?? "mock",
      providerModel: modelCfg?.model ?? "unknown",
      outputTokenBudget: {
        initialOutputTokens: sdkDefinition?.tokenBudget.initialOutputTokens ?? outputBudget?.base ?? (modelCfg?.maxTokens ?? 1200),
        repairOutputTokens:
          sdkDefinition?.tokenBudget.repairOutputTokens
          ?? Math.min(outputBudget?.max ?? (modelCfg?.maxTokens ?? 1800), (outputBudget?.base ?? 1200) + 600),
        maxOutputTokens: sdkDefinition?.tokenBudget.maxOutputTokens ?? outputBudget?.max ?? (modelCfg?.maxTokens ?? 2200),
      },
      attemptNumber: params.attemptNumber,
      repairAttemptNumber: params.repairAttemptNumber,
      executionMode: params.executionMode,
      trace: {
        pipelineId: params.pipelineId,
        agentId: params.agentId,
        correlationId: `${params.projectId ?? "unknown"}:${params.taskId ?? params.agentId}`,
      },
      requestedCapabilities: Array.isArray(params.input.requestedCapabilities)
        ? (params.input.requestedCapabilities as import("./sdk").AgentCapability[])
        : undefined,
      requestedArtifactTypes: Array.isArray(params.input.requestedArtifactTypes)
        ? (params.input.requestedArtifactTypes as import("./types/outputs").OutputModelName[])
        : undefined,
      requestedGoals: Array.isArray(params.input.requestedGoals)
        ? (params.input.requestedGoals as string[])
        : undefined,
      persistence: {
        artifactStore: globalArtifactStore,
      },
      providerManager: globalProviderManager,
      modelConfig: modelCfg,
      declaredCapabilities: globalAgentRegistry.getById(params.agentId as import("./types/agents").AgentID)?.requiredCapabilities ?? [],
    };
  }

  registerMockResponse(agentId: string, response: unknown) {
    const queue = this.mockResponses.get(agentId) ?? [];
    queue.push(response);
    this.mockResponses.set(agentId, queue);
  }

  getProgress() {
    const total = this.tasks.size;
    const completed = Array.from(this.tasks.values()).filter((t) => t.status === "completed").length;
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
