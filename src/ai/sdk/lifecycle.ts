import { makeError } from "../errors/errors";
import { getOutputBudgetByOutputModel } from "../providers/outputBudgets";
import { parseProviderRawResponse } from "../providers/responseParsing";
import { buildValidationDiagnostic, isRepairableDiagnostic, sanitizeDiagnosticForLogs } from "../validation/diagnostics";
import { logError } from "../utils/logger";
import type { AgentExecutionContext, AgentLifecycleResult, OutputContract } from "./types";
import { assertCapabilitiesDeclared, buildExecutionRequiredCapabilities, CapabilityDeniedError } from "./permissions";

function normalizeProviderResponseShape(invokeResult: unknown) {
  if (!invokeResult || typeof invokeResult !== "object") return invokeResult;
  const record = invokeResult as { output?: unknown };
  return record.output ?? invokeResult;
}

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

export async function executeAgentLifecycle(input: {
  definitionPrompt: string;
  outputContract: OutputContract;
  executionContext: AgentExecutionContext;
  providerPrompt: string;
  requiredCapabilities: AgentExecutionContext["declaredCapabilities"];
  persistencePolicy: {
    persistInvalidAttempts: boolean;
    persistValidArtifactsOnly: boolean;
  };
  maxTransportRetries: number;
  maxRepairAttempts: number;
  maxProviderCalls: number;
  getProvider: () => { id: string; invoke: (prompt: string, options: Record<string, unknown>) => Promise<unknown> } | undefined;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  buildRepairPrompt: (issues: string[]) => string;
}): Promise<{ result: AgentLifecycleResult; attempts: Array<Record<string, unknown>> }> {
  const {
    definitionPrompt,
    outputContract,
    executionContext,
    requiredCapabilities,
    maxTransportRetries,
    maxRepairAttempts,
    maxProviderCalls,
    getProvider,
    model,
    temperature,
    timeoutMs,
    buildRepairPrompt,
  } = input;

  const attempts: Array<Record<string, unknown>> = [];
  let generationAttempt = 0;
  let repairCount = 0;
  let providerCallCount = 0;
  let currentPrompt = definitionPrompt;
  const traceAgentId = executionContext.trace.agentId ?? executionContext.taskId ?? "unknown";

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

  const invokeWithTimeout = async (work: () => Promise<unknown>) => {
    if (!timeoutMs || timeoutMs <= 0) {
      return work();
    }

    return Promise.race([
      work(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(makeError({
            code: "AGENT_EXECUTION_FAILED",
            message: `Provider invocation timed out after ${timeoutMs}ms`,
            agentId: traceAgentId as never,
            retryable: true,
            details: { timeoutMs },
          }));
        }, timeoutMs);
      }),
    ]);
  };

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
        const tokenLimit = generationAttempt === 1
          ? executionContext.outputTokenBudget.initialOutputTokens
          : executionContext.outputTokenBudget.repairOutputTokens;

        providerCallCount += 1;
        invokeResult = await invokeWithTimeout(() => provider.invoke(currentPrompt, {
          model,
          temperature,
          maxTokens: tokenLimit,
          timeoutMs,
          outputModel: outputContract.outputType,
          agentId: traceAgentId,
          projectContext: executionContext.projectContext,
          userInputValues: executionContext.upstreamArtifacts.userInputValues,
        }));
        invokeError = null;
        break;
      } catch (error: unknown) {
        invokeError = error;
      }
    }

    if (invokeError) {
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

    const parsed = normalizeProviderResponseShape(invokeResult);
    const validation = outputContract.structuralValidator(parsed, executionContext.projectContext);
    const semanticIssues = validation.success
      ? outputContract.semanticValidator(validation.value, executionContext.projectContext)
      : [];
    const schemaErrors = validation.success ? [] : validation.errors;

    if (validation.success && semanticIssues.length === 0) {
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

      const saved = await executionContext.persistence.artifactStore.save({
        projectId: executionContext.projectId,
        workflowRunId: executionContext.workflowRunId,
        taskId: executionContext.taskId,
        agentId: traceAgentId,
        pipelineId: executionContext.trace.pipelineId,
        outputType: outputContract.outputType,
        content: validation.value,
        version: 1,
        artifactVersion: outputContract.persistenceMetadata.artifactVersion,
        schemaVersion: outputContract.persistenceMetadata.schemaVersion,
        validationStatus: outputContract.persistenceMetadata.validationStatusOnSuccess,
      });

      attempts.push({
        attempt: generationAttempt,
        timestamp: executionContext.clock.nowISO(),
        rawOutput: invokeResult,
        validation: { success: true },
      });

      return {
        result: {
          kind: "success",
          output: validation.value,
          artifactId: saved.artifactId,
        },
        attempts,
      };
    }

    const parseAnalysis = parseProviderRawResponse(parsed, {
      allowStringWrappedJson: true,
      allowSingleJsonCodeFence: true,
      isIncompleteResponse: false,
      isProviderRefusal: false,
    });

    const diagnostic = buildValidationDiagnostic({
      agentId: traceAgentId,
      outputType: outputContract.outputType,
      provider: executionContext.selectedProviderId,
      model,
      responseFormat: "json_schema",
      parsingStage: "json_parse_failed",
      parsingClassification: parseAnalysis.classification,
      issues: schemaErrors,
      parseSucceeded: false,
      rawResponseAvailable: true,
      rawResponseTruncated: false,
      providerRefusal: false,
      incompleteResponse: false,
      finishReason: null,
      incompleteReason: null,
      responseStatus: null,
      outputTokens: null,
      configuredOutputTokenLimit: executionContext.outputTokenBudget.initialOutputTokens,
      responseCharLength: 0,
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
        rawOutput: invokeResult,
        validation: { success: false, errors: schemaErrors },
        validationDiagnostic: diagnostic,
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
    currentPrompt = buildRepairPrompt(semanticIssues.length > 0 ? semanticIssues : toIssueMessages(schemaErrors));

    if (
      outputContract.outputType === "FinancialModel"
      && (parseAnalysis.classification === "truncated_json" || parseAnalysis.classification === "incomplete_provider_response")
    ) {
      const budget = getOutputBudgetByOutputModel(outputContract.outputType);
      if (budget && executionContext.modelConfig) {
        const current = executionContext.modelConfig.maxTokens ?? budget.base;
        executionContext.modelConfig.maxTokens = Math.min(budget.max, Math.max(current, budget.base) + 600);
      }
    }

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
