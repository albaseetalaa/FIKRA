import { createClient } from "@/lib/supabase/server";

export interface CreateProjectRpcArgs {
  p_idea: string;
  p_business_name: string | null;
  p_industry: string | null;
  p_country: string | null;
  p_city: string | null;
  p_stage: string | null;
  p_audience: string | null;
  p_age_range: string | null;
  p_customer_type: string | null;
  p_goals: string[] | null;
  p_budget: string | null;
  p_timeline: string | null;
  p_currency: string | null;
}

export interface CreateProjectRpcResult {
  projectId: string;
  organizationId: string;
  workflowRunId: string;
}

export interface CreateProjectRpcExecutor {
  execute(args: CreateProjectRpcArgs): Promise<CreateProjectRpcResult>;
}

export class ProjectCreationValidationError extends Error {
  constructor(cause?: unknown) {
    super("Invalid project input.", cause !== undefined ? { cause } : undefined);
    this.name = "ProjectCreationValidationError";
  }
}

export class ProjectCreationPersistenceError extends Error {
  constructor(cause?: unknown) {
    super("Could not create project.", cause !== undefined ? { cause } : undefined);
    this.name = "ProjectCreationPersistenceError";
  }
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseRpcRow(data: unknown): CreateProjectRpcResult {
  if (data === null || data === undefined || !Array.isArray(data)) {
    throw new ProjectCreationPersistenceError();
  }

  if (data.length !== 1) {
    throw new ProjectCreationPersistenceError();
  }

  const row = data[0];
  if (row === null || typeof row !== "object") {
    throw new ProjectCreationPersistenceError();
  }

  const candidate = row as Record<string, unknown>;
  const projectId = candidate.project_id;
  const organizationId = candidate.organization_id;
  const workflowRunId = candidate.workflow_run_id;

  if (!isNonBlankString(projectId) || !isNonBlankString(organizationId) || !isNonBlankString(workflowRunId)) {
    throw new ProjectCreationPersistenceError();
  }

  return {
    projectId,
    organizationId,
    workflowRunId,
  };
}

export async function executeCreateProjectRpc(args: CreateProjectRpcArgs): Promise<CreateProjectRpcResult> {
  const client = await createClient();
  const { data, error } = await client.rpc("create_project", args);

  if (error) {
    if (error.code === "22023") {
      throw new ProjectCreationValidationError(error);
    }
    throw new ProjectCreationPersistenceError(error);
  }

  return parseRpcRow(data);
}
