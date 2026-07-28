import { z } from "zod";
import type { OutputModelName } from "../types/outputs";
import type { ProviderParsingClassification, ProviderResponseFormat } from "../types/providerOutput";

export type ValidationStage =
  | "transport"
  | "json_parse"
  | "schema_validation"
  | "semantic_validation"
  | "terminal";

export interface ValidationIssueSummary {
  path: string;
  code: string;
  message: string;
  expected?: string | string[];
  received?: unknown;
  missingField?: boolean;
}

export interface ValidationDiagnostic {
  agentId: string;
  outputType: OutputModelName | null;
  provider: string;
  model: string | null;
  responseFormat: ProviderResponseFormat;
  validationStage: ValidationStage;
  parsingStage: string;
  parsingClassification: ProviderParsingClassification;
  schemaIssues: ValidationIssueSummary[];
  semanticIssues: ValidationIssueSummary[];
  retryable: boolean;
  rawResponseAvailable: boolean;
  rawResponseTruncated: boolean;
  finishReason: string | null;
  incompleteReason: string | null;
  responseStatus: string | null;
  outputTokens: number | null;
  configuredOutputTokenLimit: number | null;
  responseCharLength: number;
  generatedAt: string;
  parseSucceeded: boolean;
  parseFailed: boolean;
  invalidJson: boolean;
  providerRefusal: boolean;
  incompleteResponse: boolean;
  projectContextMismatch: boolean;
  unknownAdditionalFields: string[];
}

function issueToSummary(issue: z.ZodIssue): ValidationIssueSummary {
  let expected: string | string[] | undefined;
  let received: unknown;
  let missingField = false;

  if (issue.code === "invalid_enum_value") {
    const enumIssue = issue as z.ZodIssue & { options?: unknown; received?: unknown };
    expected = Array.isArray(enumIssue.options) ? enumIssue.options.map((item) => String(item)) : undefined;
    received = enumIssue.received;
  }

  if (issue.code === "invalid_type") {
    const typeIssue = issue as z.ZodIssue & { expected?: unknown; received?: unknown };
    expected = typeof typeIssue.expected === "string" ? typeIssue.expected : expected;
    received = typeIssue.received;
    missingField = issue.message.toLowerCase() === "required";
  }

  if (issue.code === "invalid_literal") {
    const literalIssue = issue as z.ZodIssue & { expected?: unknown; received?: unknown };
    expected = literalIssue.expected === undefined ? expected : String(literalIssue.expected);
    received = literalIssue.received;
  }

  return {
    path: issue.path.map((segment) => String(segment)).join("."),
    code: issue.code,
    message: issue.message,
    expected,
    received,
    missingField,
  };
}

function isSemanticIssue(issue: z.ZodIssue, outputType: OutputModelName) {
  return issue.path[0] === outputType;
}

function isProjectContextMismatch(issue: z.ZodIssue) {
  return /ProjectContext|project context|does not match ProjectContext|conflicts with normalized ProjectContext/i.test(issue.message);
}

function getUnknownAdditionalFields(issues: z.ZodIssue[]) {
  return issues
    .filter((issue) => issue.code === "unrecognized_keys")
    .flatMap((issue) => {
      const keys = (issue as z.ZodIssue & { keys?: unknown }).keys;
      return Array.isArray(keys) ? keys.map((key) => String(key)) : [];
    });
}

export function buildValidationDiagnostic(input: {
  agentId: string;
  outputType: OutputModelName;
  provider: string;
  model: string | null;
  responseFormat?: ProviderResponseFormat;
  parsingStage?: string;
  parsingClassification?: ProviderParsingClassification;
  issues: z.ZodIssue[];
  parseSucceeded: boolean;
  rawResponseAvailable: boolean;
  rawResponseTruncated: boolean;
  providerRefusal: boolean;
  incompleteResponse: boolean;
  finishReason?: string | null;
  incompleteReason?: string | null;
  responseStatus?: string | null;
  outputTokens?: number | null;
  configuredOutputTokenLimit?: number | null;
  responseCharLength?: number;
  retryable: boolean;
}): ValidationDiagnostic {
  const semanticRaw = input.issues.filter((issue) => isSemanticIssue(issue, input.outputType));
  const schemaRaw = input.issues.filter((issue) => !isSemanticIssue(issue, input.outputType));

  const semanticIssues = semanticRaw.map(issueToSummary);
  const schemaIssues = schemaRaw.map(issueToSummary);

  let validationStage: ValidationStage = "schema_validation";
  if (semanticIssues.length > 0) validationStage = "semantic_validation";
  if (!input.parseSucceeded) validationStage = "json_parse";

  const invalidJson = !input.parseSucceeded && input.rawResponseAvailable;

  return {
    agentId: input.agentId,
    outputType: input.outputType,
    provider: input.provider,
    model: input.model,
    responseFormat: input.responseFormat ?? "unknown",
    validationStage,
    parsingStage: input.parsingStage ?? "json_parse_failed",
    parsingClassification: input.parsingClassification ?? (invalidJson ? "malformed_json" : "non_json_prose"),
    schemaIssues,
    semanticIssues,
    retryable: input.retryable,
    rawResponseAvailable: input.rawResponseAvailable,
    rawResponseTruncated: input.rawResponseTruncated,
    finishReason: input.finishReason ?? null,
    incompleteReason: input.incompleteReason ?? null,
    responseStatus: input.responseStatus ?? null,
    outputTokens: input.outputTokens ?? null,
    configuredOutputTokenLimit: input.configuredOutputTokenLimit ?? null,
    responseCharLength: input.responseCharLength ?? 0,
    generatedAt: new Date().toISOString(),
    parseSucceeded: input.parseSucceeded,
    parseFailed: !input.parseSucceeded,
    invalidJson,
    providerRefusal: input.providerRefusal,
    incompleteResponse: input.incompleteResponse || input.rawResponseTruncated,
    projectContextMismatch: input.issues.some(isProjectContextMismatch),
    unknownAdditionalFields: getUnknownAdditionalFields(input.issues),
  };
}

export function isRepairableDiagnostic(diagnostic: ValidationDiagnostic) {
  if (diagnostic.providerRefusal) return false;

  const schemaMessages = diagnostic.schemaIssues.map((issue) => issue.message.toLowerCase()).join(" ");
  const hasClearlyNonRepairable =
    schemaMessages.includes("unknown model")
    || schemaMessages.includes("invalid api")
    || schemaMessages.includes("authentication")
    || schemaMessages.includes("authorization")
    || schemaMessages.includes("quota");

  if (hasClearlyNonRepairable) return false;

  return (
    diagnostic.invalidJson
    || diagnostic.incompleteResponse
    || diagnostic.schemaIssues.length > 0
    || diagnostic.semanticIssues.length > 0
  );
}

export function sanitizeDiagnosticForLogs(diagnostic: ValidationDiagnostic) {
  return {
    agentId: diagnostic.agentId,
    outputType: diagnostic.outputType,
    provider: diagnostic.provider,
    model: diagnostic.model,
    responseFormat: diagnostic.responseFormat,
    validationStage: diagnostic.validationStage,
    parsingStage: diagnostic.parsingStage,
    parsingClassification: diagnostic.parsingClassification,
    schemaIssues: diagnostic.schemaIssues,
    semanticIssues: diagnostic.semanticIssues,
    retryable: diagnostic.retryable,
    rawResponseAvailable: diagnostic.rawResponseAvailable,
    rawResponseTruncated: diagnostic.rawResponseTruncated,
    finishReason: diagnostic.finishReason,
    incompleteReason: diagnostic.incompleteReason,
    responseStatus: diagnostic.responseStatus,
    outputTokens: diagnostic.outputTokens,
    configuredOutputTokenLimit: diagnostic.configuredOutputTokenLimit,
    responseCharLength: diagnostic.responseCharLength,
    generatedAt: diagnostic.generatedAt,
    parseSucceeded: diagnostic.parseSucceeded,
    invalidJson: diagnostic.invalidJson,
    providerRefusal: diagnostic.providerRefusal,
    incompleteResponse: diagnostic.incompleteResponse,
    projectContextMismatch: diagnostic.projectContextMismatch,
    unknownAdditionalFields: diagnostic.unknownAdditionalFields,
  };
}
