import { AgentDefinition, AgentID, AgentRunResult } from "./types/agents";
import type AIProvider from "./providers/interface";
import { Pipeline, PipelineStep } from "./pipelines/pipelines";
import { logError, logInfo } from "./utils/logger";
import { validateModel } from "./validation/validator";
import { makeError, AiError } from "./errors/errors";
import { globalProviderManager } from "./providers/manager";
import defaultModels, { type ModelConfig } from "./providers/models";
import { globalArtifactStore } from "./store/setup";
import { normalizeProviderResponse } from "./normalization/normalizer";
import { promptTemplates, renderPrompt } from "./prompts/prompts";
import { buildAgentPrompt } from "./prompts/agentPromptBuilder";
import { OpenAIProviderError } from "./providers/openaiProvider";
import { getProviderOutputSchema } from "./providers/outputSchemas";
import { TaskStateMachine, type TaskStatus } from "./workflow/stateMachine";
import type { ProjectContext } from "./context";
import { buildValidationDiagnostic, isRepairableDiagnostic, sanitizeDiagnosticForLogs } from "./validation/diagnostics";
import type { ValidationDiagnostic } from "./validation/diagnostics";
import type { OutputModelName } from "./types/outputs";
import { EVIDENCE_TYPES, EVIDENCE_VALIDATION_STATUSES, MARKET_CLAIM_REQUIRED_FIELDS, UNAVAILABLE_COMPETITOR_OUTCOME_REQUIRED_FIELDS } from "./contracts/outputContracts";
import { getOutputBudgetByOutputModel } from "./providers/outputBudgets";
import { parseProviderRawResponse } from "./providers/responseParsing";

export type AttemptRecord = {
  attempt: number;
  timestamp: string;
  rawOutput: unknown;
  validation?: { success: boolean; errors?: unknown };
  validationDiagnostic?: ValidationDiagnostic;
  error?: AiError;
};

type ProviderInvocationResult = {
  providerId?: string;
  requestId?: string | null;
  model?: string;
  output?: unknown;
  metadata?: {
    startedAt?: string;
    completedAt?: string;
    parsedJson?: boolean;
    rawResponseAvailable?: boolean;
    rawResponseTruncated?: boolean;
    refusalDetected?: boolean;
    truncatedDetected?: boolean;
    finishReason?: string | null;
    responseStatus?: string | null;
    responseFormat?: "json_schema" | "text" | "unknown";
    outputType?: OutputModelName | null;
    parsingClassification?: import("./types/providerOutput").ProviderParsingClassification;
    parsingStage?: string;
    incompleteReason?: string | null;
    responseCharLength?: number;
    configuredMaxOutputTokens?: number;
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
        const dependencyOutputs = (step.dependsOn ?? [])
          .map((dependencyId) => stepOutputs.get(dependencyId))
          .filter((value) => value !== undefined);

        const stepInput: Record<string, unknown> = {
          ...(input ?? {}),
          dependencyOutputs,
        };

        if (step.agent === "market_research") {
          const businessPlan = dependencyOutputs[0];
          stepInput.businessPlan = businessPlan;
          stepInput.projectIdea = typeof input?.projectIdea === "string" ? input.projectIdea : input?.projectSummary;
          const derivedTargetMarket =
            businessPlan && typeof businessPlan === "object" && "targetMarket" in businessPlan
              ? (businessPlan as { targetMarket?: unknown }).targetMarket
              : undefined;
          stepInput.targetMarketContext =
            typeof input?.targetMarketContext === "string"
              ? input.targetMarketContext
              : typeof derivedTargetMarket === "string"
                ? derivedTargetMarket
                : "";
        }

        if (step.agent === "financial_analyst") {
          const businessPlan = dependencyOutputs.find(
            (value) =>
              value
              && typeof value === "object"
              && (
                "primaryRevenueModel" in (value as Record<string, unknown>)
                || "revenueModel" in (value as Record<string, unknown>)
              ),
          );
          const marketResearchReport = dependencyOutputs.find((value) => value && typeof value === "object" && "marketSizeEstimate" in (value as Record<string, unknown>));
          const targetMarket =
            businessPlan && typeof businessPlan === "object" && "targetMarket" in businessPlan
              ? (businessPlan as { targetMarket?: unknown }).targetMarket
              : undefined;

          stepInput.businessPlan = businessPlan;
          stepInput.marketResearchReport = marketResearchReport;
          stepInput.projectIdea = typeof input?.projectIdea === "string" ? input.projectIdea : input?.projectSummary;
          stepInput.targetMarket = typeof targetMarket === "string" ? targetMarket : "";
        }

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
    const maxTransportRetries = record?.maxRetries ?? 2;
    const maxRepairAttempts = 2;

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

    const outputModel = agent?.outputModel as OutputModelName | undefined;
    if (!outputModel) {
      const fallback = await this.invokeWithTransportRetries({
        queue,
        provider,
        providerPrompt,
        modelCfg,
        maxTransportRetries,
        agentId,
        outputModel: null,
        input,
      });
      if (!fallback.success) {
        const attemptRecord: AttemptRecord = {
          attempt: 1,
          timestamp: new Date().toISOString(),
          rawOutput: null,
          error: fallback.error,
        };
        record.attempts.push(attemptRecord);
        this.tasks.set(taskId ?? "", record);
        await this.emitAttemptRecorded(taskId ?? "", attemptRecord);
        return { agentId, success: false, error: fallback.error.message };
      }

      const parsed = normalizeProviderResponse(fallback.result);
      const attemptRecord: AttemptRecord = {
        attempt: 1,
        timestamp: new Date().toISOString(),
        rawOutput: fallback.result,
        validation: { success: true },
      };
      record.attempts.push(attemptRecord);
      this.tasks.set(taskId ?? "", record);
      await this.emitAttemptRecorded(taskId ?? "", attemptRecord);
      return { agentId, success: true, output: parsed };
    }

    let generationAttempt = 0;
    let repairCount = 0;
    let currentPrompt = providerPrompt;
    let lastProviderResult: ProviderInvocationResult | null = null;

    while (generationAttempt < 1 + maxRepairAttempts) {
      generationAttempt += 1;

      const invocation = await this.invokeWithTransportRetries({
        queue,
        provider,
        providerPrompt: currentPrompt,
        modelCfg,
        maxTransportRetries,
        agentId,
        outputModel,
        input,
      });

      if (!invocation.success) {
        const attemptRecord: AttemptRecord = {
          attempt: generationAttempt,
          timestamp: new Date().toISOString(),
          rawOutput: null,
          error: invocation.error,
          validationDiagnostic: {
            agentId,
            outputType: outputModel,
            provider: providerId,
            model: modelCfg?.model ?? null,
            responseFormat: "unknown",
            validationStage: "transport",
            parsingStage: "provider_transport",
            parsingClassification: "provider_transport_failure",
            schemaIssues: [],
            semanticIssues: [],
            retryable: false,
            rawResponseAvailable: false,
            rawResponseTruncated: false,
            finishReason: null,
            incompleteReason: null,
            responseStatus: null,
            outputTokens: null,
            configuredOutputTokenLimit: modelCfg?.maxTokens ?? null,
            responseCharLength: 0,
            generatedAt: new Date().toISOString(),
            parseSucceeded: false,
            parseFailed: true,
            invalidJson: false,
            providerRefusal: false,
            incompleteResponse: false,
            projectContextMismatch: false,
            unknownAdditionalFields: [],
          },
        };
        record.attempts.push(attemptRecord);
        this.tasks.set(taskId ?? "", record);
        await this.emitAttemptRecorded(taskId ?? "", attemptRecord);
        return { agentId, success: false, error: invocation.error.message };
      }

      lastProviderResult = invocation.result as ProviderInvocationResult;
      const parsed = normalizeProviderResponse(invocation.result);
      const validation = validateModel(outputModel, parsed, {
        projectContext: input?.projectContext as ProjectContext | undefined,
      });

      const parseSucceeded =
        typeof lastProviderResult?.metadata?.parsedJson === "boolean"
          ? Boolean(lastProviderResult.metadata.parsedJson)
          : typeof parsed !== "string";
      const rawResponseAvailable =
        typeof lastProviderResult?.metadata?.rawResponseAvailable === "boolean"
          ? Boolean(lastProviderResult.metadata.rawResponseAvailable)
          : invocation.result != null;
      const rawResponseTruncated =
        typeof lastProviderResult?.metadata?.rawResponseTruncated === "boolean"
          ? Boolean(lastProviderResult.metadata.rawResponseTruncated)
          : false;
      const providerRefusal =
        typeof lastProviderResult?.metadata?.refusalDetected === "boolean"
          ? Boolean(lastProviderResult.metadata.refusalDetected)
          : false;
      const incompleteResponse =
        rawResponseTruncated
        || Boolean(lastProviderResult?.metadata?.truncatedDetected)
        || lastProviderResult?.metadata?.finishReason === "max_output_tokens"
        || lastProviderResult?.metadata?.responseStatus === "incomplete";

      const parsingClassification =
        lastProviderResult?.metadata?.parsingClassification
        ?? parseProviderRawResponse(typeof invocation.result?.output === "string" ? invocation.result.output : invocation.result, {
          allowStringWrappedJson: true,
          allowSingleJsonCodeFence: true,
          isIncompleteResponse: incompleteResponse,
          isProviderRefusal: providerRefusal,
        }).classification;
      const parsingStage = lastProviderResult?.metadata?.parsingStage ?? "json_parse_failed";
      const configuredOutputTokenLimit =
        typeof lastProviderResult?.metadata?.configuredMaxOutputTokens === "number"
          ? lastProviderResult.metadata.configuredMaxOutputTokens
          : modelCfg?.maxTokens ?? null;
      const responseFormat = lastProviderResult?.metadata?.responseFormat ?? "unknown";
      const responseCharLength = typeof lastProviderResult?.metadata?.responseCharLength === "number"
        ? lastProviderResult.metadata.responseCharLength
        : 0;

      const attemptRecord: AttemptRecord = {
        attempt: generationAttempt,
        timestamp: new Date().toISOString(),
        rawOutput: invocation.result,
        validation: validation.success ? { success: true } : { success: false, errors: validation.errors },
      };

      if (validation.success) {
        record.attempts.push(attemptRecord);
        this.tasks.set(taskId ?? "", record);
        await this.emitAttemptRecorded(taskId ?? "", attemptRecord);

        const saved = await globalArtifactStore.save({
          projectId: projectId ?? "unknown",
          workflowRunId,
          taskId: this.buildPersistedTaskId(taskId, workflowRunId),
          agentId,
          pipelineId: pipelineId ?? "",
          outputType: outputModel,
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
            providerId: lastProviderResult?.providerId ?? provider?.id ?? "mock",
            requestId: lastProviderResult?.requestId ?? null,
            model: modelCfg?.model,
            startedAt: lastProviderResult?.metadata?.startedAt ?? null,
            completedAt: lastProviderResult?.metadata?.completedAt ?? null,
            artifactId: saved.artifactId,
            attemptNumber: generationAttempt,
            schemaRepairCount: repairCount,
          },
          usage: lastProviderResult?.usage,
        };
      }

      const diagnostic = buildValidationDiagnostic({
        agentId,
        outputType: outputModel,
        provider: lastProviderResult?.providerId ?? providerId,
        model: lastProviderResult?.model ?? modelCfg?.model ?? null,
        responseFormat,
        parsingStage,
        parsingClassification,
        issues: validation.errors,
        parseSucceeded,
        rawResponseAvailable,
        rawResponseTruncated,
        providerRefusal,
        incompleteResponse,
        finishReason: lastProviderResult?.metadata?.finishReason ?? null,
        incompleteReason: lastProviderResult?.metadata?.incompleteReason ?? null,
        responseStatus: lastProviderResult?.metadata?.responseStatus ?? null,
        outputTokens: lastProviderResult?.usage?.outputTokens ?? null,
        configuredOutputTokenLimit,
        responseCharLength,
        retryable: false,
      });

      attemptRecord.validationDiagnostic = diagnostic;
      const canRepair = repairCount < maxRepairAttempts && isRepairableDiagnostic(diagnostic);
      diagnostic.retryable = canRepair;

      const err = makeError({
        code: "SCHEMA_VALIDATION_FAILED",
        message: "Output did not match expected schema",
        agentId,
        pipelineId,
        taskId,
        retryable: canRepair,
        details: {
          issues: validation.errors,
          diagnostic: sanitizeDiagnosticForLogs(diagnostic),
          generationAttempt,
          schemaRepairCount: repairCount,
        },
      });

      attemptRecord.error = err;
      record.attempts.push(attemptRecord);
      this.tasks.set(taskId ?? "", record);
      await this.emitAttemptRecorded(taskId ?? "", attemptRecord);
      logError("Validation diagnostic", sanitizeDiagnosticForLogs(diagnostic));

      if (!canRepair) {
        return { agentId, success: false, error: err.message };
      }

      repairCount += 1;
      currentPrompt = this.buildRepairPrompt({
        outputModel,
        originalPrompt: providerPrompt,
        projectContext: input?.projectContext as ProjectContext | undefined,
        validationDiagnostic: diagnostic,
      });

      if (
        outputModel === "FinancialModel"
        && (diagnostic.parsingClassification === "truncated_json"
          || diagnostic.parsingClassification === "incomplete_provider_response"
          || diagnostic.finishReason === "max_output_tokens")
      ) {
        const budget = getOutputBudgetByOutputModel(outputModel);
        if (budget && modelCfg) {
          const current = modelCfg.maxTokens ?? budget.base;
          modelCfg.maxTokens = Math.min(budget.max, Math.max(current, budget.base) + 600);
        }
      }
    }

    return { agentId, success: false, error: "Exceeded validation repair attempts" };
  }

  private async invokeWithTransportRetries(params: {
    queue: unknown[];
    provider: AIProvider | undefined;
    providerPrompt: string;
    modelCfg: ModelConfig | undefined;
    maxTransportRetries: number;
    agentId: string;
    outputModel: OutputModelName | null;
    input?: Record<string, unknown>;
  }): Promise<{ success: true; result: ProviderInvocationResult } | { success: false; error: AiError }> {
    const {
      queue,
      provider,
      providerPrompt,
      modelCfg,
      maxTransportRetries,
      agentId,
      outputModel,
      input,
    } = params;

    if (queue.length > 0) {
      const queued = queue.shift();
      return {
        success: true,
        result: {
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
        },
      };
    }

    if (!provider) {
      return {
        success: true,
        result: {
          providerId: "prompt-fallback",
          model: modelCfg?.model,
          output: providerPrompt,
          metadata: {
            startedAt: undefined,
            completedAt: undefined,
            parsedJson: false,
            rawResponseAvailable: true,
            rawResponseTruncated: false,
            refusalDetected: false,
            truncatedDetected: false,
          },
        },
      };
    }

    for (let transportAttempt = 1; transportAttempt <= maxTransportRetries; transportAttempt += 1) {
      try {
        const invokeRes = await provider.invoke(providerPrompt, {
          model: modelCfg?.model,
          temperature: modelCfg?.temperature,
          maxTokens: modelCfg?.maxTokens,
          timeoutMs: modelCfg?.timeoutMs,
          outputModel: outputModel ?? undefined,
          agentId,
          projectContext: input?.projectContext,
          userInputValues: input?.userInputValues,
        });

        const providerResult = invokeRes as ProviderInvocationResult;
        if (providerResult.output === undefined) {
          providerResult.output = normalizeProviderResponse(invokeRes);
        }
        return { success: true, result: providerResult };
      } catch (e: unknown) {
        const isOpenAIError = e instanceof OpenAIProviderError;
        const retryable = isOpenAIError ? e.retryable : true;
        const err = makeError({
          code: "AGENT_EXECUTION_FAILED",
          message: isOpenAIError ? e.message : String(e instanceof Error ? e.message : e),
          agentId,
          retryable,
          details: isOpenAIError
            ? { providerCode: e.code, providerId: e.providerId, model: e.model, transportAttempt }
            : { transportAttempt },
        });

        if (transportAttempt < maxTransportRetries && retryable) {
          continue;
        }

        return { success: false, error: err };
      }
    }

    return {
      success: false,
      error: makeError({
        code: "AGENT_EXECUTION_FAILED",
        message: "Provider transport retries exhausted.",
        agentId,
        retryable: false,
      }),
    };
  }

  private buildRepairPrompt(params: {
    outputModel: OutputModelName;
    originalPrompt: string;
    projectContext?: ProjectContext;
    validationDiagnostic: ValidationDiagnostic;
  }) {
    const projectContextJson = params.projectContext ? JSON.stringify(params.projectContext, null, 2) : "{}";
    const schemaIssues = params.validationDiagnostic.schemaIssues.map((issue) => {
      const expected = issue.expected !== undefined
        ? ` expected=${Array.isArray(issue.expected) ? issue.expected.join(" | ") : issue.expected}`
        : "";
      const received = issue.received !== undefined ? ` received=${JSON.stringify(issue.received)}` : "";
      const missing = issue.missingField ? " missingField=true" : "";
      return `- ${issue.path || "root"}: ${issue.message}${expected}${received}${missing}`;
    });
    const semanticIssues = params.validationDiagnostic.semanticIssues.map((issue) => {
      const expected = issue.expected !== undefined
        ? ` expected=${Array.isArray(issue.expected) ? issue.expected.join(" | ") : issue.expected}`
        : "";
      const received = issue.received !== undefined ? ` received=${JSON.stringify(issue.received)}` : "";
      return `- ${issue.path || "root"}: ${issue.message}${expected}${received}`;
    });
    const canonicalSchema = getProviderOutputSchema(params.outputModel);
    const canonicalSchemaJson = canonicalSchema ? JSON.stringify(canonicalSchema, null, 2) : "{}";

    const marketSpecificGuidance = params.outputModel === "MarketResearchReport"
      ? [
          `Market claim required fields: ${MARKET_CLAIM_REQUIRED_FIELDS.join(", ")}.`,
          `evidenceType enum: ${EVIDENCE_TYPES.join(" | ")}.`,
          `validationStatus enum: ${EVIDENCE_VALIDATION_STATUSES.join(" | ")}.`,
          "Do not place evidenceType values inside validationStatus.",
          "If evidenceType is not verified_source, validationStatus must not be verified.",
          `When competitorDataStatus=unavailable, unavailableCompetitorOutcome must include ${UNAVAILABLE_COMPETITOR_OUTCOME_REQUIRED_FIELDS.join(", ")}, and array fields must exist even if empty.`,
          "When competitorDataStatus is verified or partially_verified, unavailableCompetitorOutcome must be null.",
        ].join("\n")
      : "";

    const truncationGuidance =
      params.outputModel === "FinancialModel"
      && (
        params.validationDiagnostic.parsingClassification === "truncated_json"
        || params.validationDiagnostic.parsingClassification === "incomplete_provider_response"
        || params.validationDiagnostic.finishReason === "max_output_tokens"
      )
        ? [
            "Previous response was incomplete/truncated.",
            "Regenerate the entire FinancialModel object from scratch.",
            "Do not attempt fragment completion.",
            "Keep explanations concise while preserving all required schema fields.",
            "Return only one complete compact structured object.",
          ].join("\n")
        : "";

    return [
      "Return only a corrected JSON object.",
      `Target schema: ${params.outputModel}`,
      "You must preserve the same business facts and project context. Do not invent unrelated facts.",
      "Original task prompt:",
      params.originalPrompt,
      "ProjectContext:",
      projectContextJson,
      "Canonical structured-output schema to satisfy exactly:",
      canonicalSchemaJson,
      "Structural validation issues to fix:",
      schemaIssues.length > 0 ? schemaIssues.join("\n") : "- none",
      "Semantic validation issues to fix:",
      semanticIssues.length > 0 ? semanticIssues.join("\n") : "- none",
      params.validationDiagnostic.unknownAdditionalFields.length > 0
        ? `Unknown additional fields to remove: ${params.validationDiagnostic.unknownAdditionalFields.join(", ")}`
        : "Unknown additional fields to remove: none",
      marketSpecificGuidance ? `MarketResearchReport canonical guidance:\n${marketSpecificGuidance}` : "",
      truncationGuidance ? `FinancialModel truncation guidance:\n${truncationGuidance}` : "",
      "Do not silently reinterpret semantically different enum values; correct them explicitly.",
      "Do not include markdown fences or commentary.",
    ].join("\n\n");
  }

  registerMockResponse(agentId: string, response: unknown) {
    const queue = this.mockResponses.get(agentId) ?? [];
    queue.push(response);
    this.mockResponses.set(agentId, queue);
  }

  private buildPrompt(agentId: AgentID, input?: Record<string, unknown>) {
    const projectContext = (input?.projectContext as ProjectContext | undefined) ?? undefined;
    if (projectContext && (agentId === "business_strategist" || agentId === "market_research" || agentId === "financial_analyst")) {
      const upstreamArtifacts: Record<string, unknown> = {};
      if (input?.businessPlan) upstreamArtifacts.businessPlan = input.businessPlan;
      if (input?.marketResearchReport) upstreamArtifacts.marketResearchReport = input.marketResearchReport;
      return buildAgentPrompt({
        agentId,
        projectContext,
        upstreamArtifacts,
        requiredSchemaName:
          agentId === "business_strategist"
            ? "BusinessPlan"
            : agentId === "market_research"
              ? "MarketResearchReport"
              : agentId === "financial_analyst"
                ? "FinancialModel"
                : undefined,
      });
    }

    const template = promptTemplates[agentId];
    if (!template) return input ? JSON.stringify(input) : undefined;
    if (agentId === "business_strategist") {
      const projectSummary =
        typeof input?.projectSummary === "string"
          ? input.projectSummary
          : typeof input?.projectIdea === "string"
            ? input.projectIdea
            : JSON.stringify(input ?? {});
      return renderPrompt(template, { projectSummary });
    }
    if (agentId === "market_research") {
      const projectIdea = typeof input?.projectIdea === "string" ? input.projectIdea : typeof input?.projectSummary === "string" ? input.projectSummary : "";
      const businessPlanJson = input?.businessPlan ? JSON.stringify(input.businessPlan) : "{}";
      const targetMarketContext = typeof input?.targetMarketContext === "string" ? input.targetMarketContext : "";
      return renderPrompt(template, { projectIdea, businessPlanJson, targetMarketContext });
    }
    if (agentId === "financial_analyst") {
      const projectIdea = typeof input?.projectIdea === "string" ? input.projectIdea : typeof input?.projectSummary === "string" ? input.projectSummary : "";
      const businessPlanJson = input?.businessPlan ? JSON.stringify(input.businessPlan) : "{}";
      const marketResearchReportJson = input?.marketResearchReport ? JSON.stringify(input.marketResearchReport) : "{}";
      const targetMarket = typeof input?.targetMarket === "string" ? input.targetMarket : "";
      return renderPrompt(template, { projectIdea, businessPlanJson, marketResearchReportJson, targetMarket });
    }
    return renderPrompt(template, { projectSummary: JSON.stringify(input ?? {}) });
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
