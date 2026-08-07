import { makeError } from "../errors/errors";
import { getOutputBudgetByOutputModel } from "../providers/outputBudgets";
import { parseProviderRawResponse } from "../providers/responseParsing";
import { buildValidationDiagnostic, isRepairableDiagnostic, sanitizeDiagnosticForLogs } from "../validation/diagnostics";
import { logError } from "../utils/logger";
import type { AgentExecutionContext, AgentLifecycleResult, AgentLifecycleHooks, OutputContract } from "./types";
import { assertCapabilitiesDeclared, buildExecutionRequiredCapabilities, CapabilityDeniedError } from "./permissions";

type ProviderInvokeMetadata = {
  finishReason: string | null;
  incompleteReason: string | null;
  responseStatus: string | null;
  outputTokens: number | null;
  inputTokens: number | null;
  configuredOutputTokenLimit: number | null;
  responseCharLength: number;
  providerRefusal: boolean;
  incompleteResponse: boolean;
  rawResponseAvailable: boolean;
  rawResponseTruncated: boolean;
  parsingClassification: string | null;
  parsingStage: string | null;
};

function toIssueMessages(errors: Array<{ message?: string }> | undefined) {
  return (errors ?? []).map((issue) => issue.message ?? "Unknown validation issue");
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function extractProviderResponse(invokeResult: unknown): { rawPayload: unknown; output: unknown; metadata: ProviderInvokeMetadata } {
  const record = invokeResult && typeof invokeResult === "object"
    ? (invokeResult as Record<string, unknown>)
    : {};

  const meta = record.metadata && typeof record.metadata === "object"
    ? (record.metadata as Record<string, unknown>)
    : {};

  const usage = record.usage && typeof record.usage === "object"
    ? (record.usage as Record<string, unknown>)
    : {};

  const output = Object.prototype.hasOwnProperty.call(record, "output") ? record.output : invokeResult;

  const configuredOutputTokenLimit =
    typeof meta.configuredMaxOutputTokens === "number"
      ? meta.configuredMaxOutputTokens
      : typeof meta.configuredOutputTokenLimit === "number"
        ? meta.configuredOutputTokenLimit
        : null;

  const responseStatus = isNonEmptyString(meta.responseStatus)
    ? String(meta.responseStatus)
    : isNonEmptyString(record.responseStatus)
      ? String(record.responseStatus)
      : null;

  const incompleteReason = isNonEmptyString(meta.incompleteReason)
    ? String(meta.incompleteReason)
    : isNonEmptyString(record.incompleteReason)
      ? String(record.incompleteReason)
      : null;

  const finishReason = isNonEmptyString(meta.finishReason)
    ? String(meta.finishReason)
    : isNonEmptyString(record.finishReason)
      ? String(record.finishReason)
      : null;

  const responseCharLength =
    typeof meta.responseCharLength === "number"
      ? meta.responseCharLength
      : typeof output === "string"
        ? output.length
        : 0;

  const providerRefusal = Boolean(meta.refusalDetected ?? record.refusalDetected ?? false);
  const metadataIncomplete = responseStatus === "incomplete" || incompleteReason != null;
  const rawResponseTruncated = Boolean(meta.rawResponseTruncated ?? meta.truncatedDetected ?? record.rawResponseTruncated ?? false);

  return {
    rawPayload: invokeResult,
    output,
    metadata: {
      finishReason,
      incompleteReason,
      responseStatus,
      outputTokens: typeof usage.outputTokens === "number" ? usage.outputTokens : null,
      inputTokens: typeof usage.inputTokens === "number" ? usage.inputTokens : null,
      configuredOutputTokenLimit,
      responseCharLength,
      providerRefusal,
      incompleteResponse: metadataIncomplete,
      rawResponseAvailable: Boolean(meta.rawResponseAvailable ?? output != null),
      rawResponseTruncated,
      parsingClassification: isNonEmptyString(meta.parsingClassification) ? String(meta.parsingClassification) : null,
      parsingStage: isNonEmptyString(meta.parsingStage) ? String(meta.parsingStage) : null,
    },
  };
}

function makeCancellationError() {
  const error = new Error("Execution cancelled") as Error & { code?: string };
  error.code = "EXECUTION_CANCELLED";
  return error;
}

function enforceContextPolicies(input: {
  executionContext: AgentExecutionContext;
  requiredProjectContextFields: string[];
  supportedVerticals: readonly string[];
}) {
  const issues: string[] = [];
  const projectContextRecord = input.executionContext.projectContext as unknown as Record<string, unknown>;
  for (const field of input.requiredProjectContextFields) {
    const value = projectContextRecord[field];
    if (
      value === undefined
      || value === null
      || (typeof value === "string" && value.trim().length === 0)
      || (Array.isArray(value) && value.length === 0)
    ) {
      issues.push(`Missing required ProjectContext field '${field}'.`);
    }
  }

  if (
    input.supportedVerticals[0] !== "any"
    && !input.supportedVerticals.includes(String(input.executionContext.projectContext.businessVertical))
  ) {
    issues.push(
      `Unsupported business vertical '${input.executionContext.projectContext.businessVertical}' for this agent.`,
    );
  }

  // launchTimelineDays only has a real value for the "fixed" mode — "asap"
  // and "flexible" are valid, resolved states with a null day count, so
  // requiring launchTimelineDays unconditionally (via requiredProjectContextFields)
  // would wrongly reject them. Enforced here instead, conditioned on mode.
  if (
    input.executionContext.projectContext.launchTimelineMode === "fixed"
    && input.executionContext.projectContext.launchTimelineDays === null
  ) {
    issues.push("Missing required ProjectContext field 'launchTimelineDays' for a fixed launch timeline.");
  }

  return issues;
}

export async function executeAgentLifecycle(input: {
  definitionPrompt: string;
  outputContract: OutputContract;
  executionContext: AgentExecutionContext;
  requiredCapabilities: AgentExecutionContext["declaredCapabilities"];
  requiredProjectContextFields: string[];
  supportedVerticals: readonly string[];
  persistencePolicy: {
    persistInvalidAttempts: boolean;
    persistValidArtifactsOnly: boolean;
  };
  maxTransportRetries: number;
  maxRepairAttempts: number;
  maxProviderCalls: number;
  getProvider: () => { id: string; invoke: (prompt: string, options: Record<string, unknown>) => Promise<unknown> } | undefined;
  model: string;
  lifecycleHooks?: AgentLifecycleHooks;
  temperature?: number;
  timeoutMs?: number;
  buildRepairPrompt: (issues: string[]) => string;
}): Promise<{ result: AgentLifecycleResult; attempts: Array<Record<string, unknown>> }> {
  const {
    definitionPrompt,
    outputContract,
    executionContext,
    requiredCapabilities,
    requiredProjectContextFields,
    supportedVerticals,
    maxTransportRetries,
    maxRepairAttempts,
    maxProviderCalls,
    getProvider,
    model,
    lifecycleHooks,
    temperature,
    timeoutMs,
    buildRepairPrompt,
  } = input;

  const attempts: Array<Record<string, unknown>> = [];
  let generationAttempt = 0;
  let repairCount = 0;
  let providerCallCount = 0;
  let currentPrompt = definitionPrompt;
  let nextTokenBudget = executionContext.outputTokenBudget.initialOutputTokens;
  const traceAgentId = executionContext.trace.agentId ?? executionContext.taskId ?? "unknown";

  const policyIssues = enforceContextPolicies({
    executionContext,
    requiredProjectContextFields,
    supportedVerticals,
  });
  if (policyIssues.length > 0) {
    return {
      result: {
        kind: "non_retryable_failure",
        message: policyIssues.join(" "),
        retryable: false,
        issues: policyIssues,
      },
      attempts,
    };
  }

  const runtimeRequiredCapabilities = buildExecutionRequiredCapabilities({
    declaredCapabilities: requiredCapabilities,
    requiresProviderCall: true,
  });

  try {
    assertCapabilitiesDeclared(executionContext.declaredCapabilities, runtimeRequiredCapabilities);
  } catch (error: unknown) {
    if (error instanceof CapabilityDeniedError) {
      attempts.push({
        attempt: 0,
        timestamp: executionContext.clock.nowISO(),
        rawOutput: null,
        error,
      });
      return {
        result: {
          kind: "non_retryable_failure",
          message: error.message,
          retryable: false,
          metadata: {
            code: error.code,
            requiredCapabilities: error.required,
            declaredCapabilities: error.declared,
            missingCapabilities: error.missing,
          },
        },
        attempts,
      };
    }
    throw error;
  }

  while (generationAttempt < maxProviderCalls) {
    if (executionContext.cancellationSignal?.aborted) {
      return {
        result: {
          kind: "cancelled",
          message: "Execution cancelled",
          retryable: false,
        },
        attempts,
      };
    }

    generationAttempt += 1;

    let invokeResult: unknown = null;
    let invokeError: unknown = null;
    for (let transportAttempt = 1; transportAttempt <= maxTransportRetries; transportAttempt += 1) {
      if (providerCallCount >= maxProviderCalls) {
        break;
      }

      const provider = getProvider();
      if (!provider) {
        invokeError = makeError({
          code: "AGENT_EXECUTION_FAILED",
          message: `Provider '${executionContext.selectedProviderId}' is not registered or not available.`,
          agentId: traceAgentId as never,
          retryable: false,
        });
        break;
      }

      try {
        await lifecycleHooks?.beforeExecute?.(executionContext);

        providerCallCount += 1;

        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        let cancellationHandler: (() => void) | undefined;
        const cancellationPromise = new Promise<never>((_, reject) => {
          cancellationHandler = () => reject(makeCancellationError());
          if (executionContext.cancellationSignal) {
            executionContext.cancellationSignal.addEventListener("abort", cancellationHandler);
          }
        });

        const invokePromise = provider.invoke(currentPrompt, {
          model,
          temperature,
          maxTokens: nextTokenBudget,
          timeoutMs,
          outputModel: outputContract.outputType,
          agentId: traceAgentId,
          projectContext: executionContext.projectContext,
          requestedCapabilities: executionContext.requestedCapabilities,
          requestedArtifactTypes: executionContext.requestedArtifactTypes,
          userInputValues: executionContext.upstreamArtifacts.userInputValues,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          if (!timeoutMs || timeoutMs <= 0) {
            return;
          }
          timeoutHandle = setTimeout(() => {
            reject(makeError({
              code: "AGENT_EXECUTION_FAILED",
              message: `Provider invocation timed out after ${timeoutMs}ms`,
              agentId: traceAgentId as never,
              retryable: true,
              details: { timeoutMs },
            }));
          }, timeoutMs);
        });

        try {
          invokeResult = await Promise.race([invokePromise, timeoutPromise, cancellationPromise]);
        } finally {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          if (executionContext.cancellationSignal && cancellationHandler) {
            executionContext.cancellationSignal.removeEventListener("abort", cancellationHandler);
          }
        }

        await lifecycleHooks?.afterExecute?.(executionContext, invokeResult);

        invokeError = null;
        break;
      } catch (error: unknown) {
        invokeError = error;
      }
    }

    if (invokeError) {
      if ((invokeError as { code?: string }).code === "EXECUTION_CANCELLED") {
        return {
          result: {
            kind: "cancelled",
            message: "Execution cancelled",
            retryable: false,
          },
          attempts,
        };
      }

      if (input.persistencePolicy.persistInvalidAttempts) {
        attempts.push({
          attempt: generationAttempt,
          timestamp: executionContext.clock.nowISO(),
          rawOutput: null,
          error: invokeError,
        });
      }
      return {
        result: {
          kind: providerCallCount >= maxProviderCalls ? "non_retryable_failure" : "retryable_failure",
          message: errorMessage(invokeError, "Provider invocation failed"),
          retryable: providerCallCount < maxProviderCalls,
          metadata: {
            providerCallCount,
            maxProviderCalls,
          },
        },
        attempts,
      };
    }

    const extracted = extractProviderResponse(invokeResult);
    const parseAnalysis = parseProviderRawResponse(extracted.output, {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: extracted.metadata.incompleteResponse || extracted.metadata.rawResponseTruncated,
      isProviderRefusal: extracted.metadata.providerRefusal,
    });

    const parseSucceeded = parseAnalysis.parseSucceeded;
    const parsedOutput = parseSucceeded ? parseAnalysis.value : null;

    const schemaErrors: Array<{ message: string; path?: unknown; code?: string }> = [];
    let semanticIssues: string[] = [];
    let validatedValue: unknown = null;

    if (parseSucceeded) {
      const structural = outputContract.structuralValidator(parsedOutput, executionContext.projectContext);
      if (structural.success) {
        validatedValue = structural.value;
        semanticIssues = outputContract.semanticValidator(validatedValue, executionContext.projectContext);
      } else {
        schemaErrors.push(...(structural.errors as Array<{ message: string; path?: unknown; code?: string }>));
      }
    }

    if (parseSucceeded && schemaErrors.length === 0 && semanticIssues.length === 0) {
      if (executionContext.cancellationSignal?.aborted) {
        return {
          result: {
            kind: "cancelled",
            message: "Execution cancelled",
            retryable: false,
          },
          attempts,
        };
      }

      await lifecycleHooks?.beforePersist?.(executionContext, validatedValue);
      const saved = await executionContext.persistence.artifactStore.save({
        projectId: executionContext.projectId,
        workflowRunId: executionContext.workflowRunId,
        taskId: executionContext.taskId,
        agentId: traceAgentId,
        pipelineId: executionContext.trace.pipelineId,
        outputType: outputContract.outputType,
        content: validatedValue,
        version: 1,
        artifactVersion: outputContract.persistenceMetadata.artifactVersion,
        schemaVersion: outputContract.persistenceMetadata.schemaVersion,
        validationStatus: outputContract.persistenceMetadata.validationStatusOnSuccess,
      });
      await lifecycleHooks?.afterPersist?.(executionContext, saved.artifactId);

      attempts.push({
        attempt: generationAttempt,
        timestamp: executionContext.clock.nowISO(),
        rawOutput: extracted.rawPayload,
        validation: { success: true },
      });

      return {
        result: {
          kind: "success",
          output: validatedValue,
          artifactId: saved.artifactId,
          usage: {
            inputTokens: extracted.metadata.inputTokens ?? undefined,
            outputTokens: extracted.metadata.outputTokens ?? undefined,
            totalTokens:
              extracted.metadata.inputTokens != null && extracted.metadata.outputTokens != null
                ? extracted.metadata.inputTokens + extracted.metadata.outputTokens
                : undefined,
          },
        },
        attempts,
      };
    }

    const diagnostic = buildValidationDiagnostic({
      agentId: traceAgentId,
      outputType: outputContract.outputType,
      provider: executionContext.selectedProviderId,
      model,
      responseFormat: "json_schema",
      parsingStage: extracted.metadata.parsingStage ?? "json_parse_failed",
      parsingClassification: (extracted.metadata.parsingClassification as never) ?? parseAnalysis.classification,
      issues: parseSucceeded
        ? (schemaErrors.map((issue) => ({
            code: issue.code ?? "custom",
            message: issue.message,
            path: Array.isArray(issue.path) ? issue.path : [issue.path ?? ""],
          })) as never)
        : ([
            {
              code: "invalid_type",
              message: `Failed to parse provider response as strict JSON object (${parseAnalysis.classification}).`,
              path: [],
            },
          ] as never),
      parseSucceeded,
      rawResponseAvailable: extracted.metadata.rawResponseAvailable,
      rawResponseTruncated: extracted.metadata.rawResponseTruncated || parseAnalysis.rawResponseTruncated,
      providerRefusal: extracted.metadata.providerRefusal,
      incompleteResponse: extracted.metadata.incompleteResponse || parseAnalysis.incompleteProviderResponse,
      finishReason: extracted.metadata.finishReason,
      incompleteReason: extracted.metadata.incompleteReason,
      responseStatus: extracted.metadata.responseStatus,
      outputTokens: extracted.metadata.outputTokens,
      configuredOutputTokenLimit: extracted.metadata.configuredOutputTokenLimit ?? nextTokenBudget,
      responseCharLength: extracted.metadata.responseCharLength || parseAnalysis.responseCharLength,
      retryable: false,
    });

    if (semanticIssues.length > 0) {
      diagnostic.semanticIssues = semanticIssues.map((message) => ({
        path: "",
        code: "semantic_validation",
        message,
      }));
      diagnostic.validationStage = "semantic_validation";
      diagnostic.parseSucceeded = true;
    }

    if (input.persistencePolicy.persistInvalidAttempts) {
      attempts.push({
        attempt: generationAttempt,
        timestamp: executionContext.clock.nowISO(),
        rawOutput: extracted.rawPayload,
        validation: { success: false, errors: schemaErrors },
        validationDiagnostic: diagnostic,
      });
    }

    const canPersistInvalid =
      outputContract.persistenceMetadata.persistInvalidArtifacts
      && !input.persistencePolicy.persistValidArtifactsOnly;

    if (canPersistInvalid) {
      await executionContext.persistence.artifactStore.save({
        projectId: executionContext.projectId,
        workflowRunId: executionContext.workflowRunId,
        taskId: executionContext.taskId,
        agentId: traceAgentId,
        pipelineId: executionContext.trace.pipelineId,
        outputType: outputContract.outputType,
        content: parseSucceeded ? parseAnalysis.value : extracted.output,
        version: 1,
        artifactVersion: outputContract.persistenceMetadata.artifactVersion,
        schemaVersion: outputContract.persistenceMetadata.schemaVersion,
        validationStatus: "invalid",
      });
    }

    const repairable =
      repairCount < maxRepairAttempts
      && providerCallCount < maxProviderCalls
      && isRepairableDiagnostic(diagnostic);
    if (!repairable) {
      return {
        result: {
          kind: "non_retryable_failure",
          message: semanticIssues.length > 0 ? "Output failed semantic validation" : "Output did not match expected schema",
          retryable: false,
          issues: semanticIssues.length > 0 ? semanticIssues : toIssueMessages(schemaErrors),
          metadata: {
            diagnostic: sanitizeDiagnosticForLogs(diagnostic),
            providerCallCount,
            maxProviderCalls,
          },
        },
        attempts,
      };
    }

    repairCount += 1;

    if (
      outputContract.outputType === "FinancialModel"
      && (parseAnalysis.classification === "truncated_json" || parseAnalysis.classification === "incomplete_provider_response")
    ) {
      const budget = getOutputBudgetByOutputModel(outputContract.outputType);
      if (budget) {
        nextTokenBudget = Math.min(budget.max, Math.max(nextTokenBudget, executionContext.outputTokenBudget.repairOutputTokens) + 600);
      }
    } else {
      nextTokenBudget = executionContext.outputTokenBudget.repairOutputTokens;
    }

    currentPrompt = buildRepairPrompt(semanticIssues.length > 0 ? semanticIssues : toIssueMessages(schemaErrors));
    logError("Validation diagnostic", sanitizeDiagnosticForLogs(diagnostic));
  }

  return {
    result: {
      kind: "non_retryable_failure",
      message: "Exceeded validation repair attempts",
      retryable: false,
      metadata: {
        providerCallCount,
        maxProviderCalls,
      },
    },
    attempts,
  };
}
