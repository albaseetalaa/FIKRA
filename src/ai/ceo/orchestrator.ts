import { agents as defaultAgents } from "../agents/definitions";
import type { AgentDefinition, AgentID } from "../types/agents";
import Orchestrator, { type OrchestratorHooks, type TaskRecord } from "../orchestrator";
import type { Pipeline, PipelineStep } from "../pipelines/pipelines";
import { pipelines as defaultPipelines } from "../pipelines/pipelines";
import defaultModels, { type ModelConfig } from "../providers/models";
import type { ProjectContext } from "../context";
import { RetryEngine, defaultRetryPolicy, type RetryPolicy, type SleepFunction } from "../reliability";
import type {
  PauseReason,
  UserInputFieldDefinition,
  UserInputRequest,
  WorkflowCheckpoint,
} from "../reliability";
import { globalArtifactStore } from "../store/setup";
import { validateModel } from "../validation/validator";
import type { ExecutionPlan } from "../types/outputs";
import { TaskStateMachine, WorkflowStateMachine, type TaskStatus } from "../workflow/stateMachine";
import type { Clock } from "../../lib/time/clock";
import { systemClock } from "../../lib/time/clock";

const CEO_AGENT_ID = "ceo_orchestrator";

type DependencyGraph = Record<string, string[]>;

const dependencyTemplate: DependencyGraph = {
  business_strategist: [],
  market_research: ["business_strategist"],
  financial_analyst: ["business_strategist", "market_research"],
};

const agentPriority: Record<string, number> = {
  business_strategist: 1,
  market_research: 2,
  financial_analyst: 3,
};

export type CeoExecutionState = {
  status: ExecutionPlan["currentStatus"];
  currentAgent: string | null;
  completedAgents: string[];
  failedAgents: string[];
  retriesRecommended: string[];
  taskStatusByAgent: Record<string, TaskStatus>;
  attemptCountByAgent: Record<string, number>;
};

export type CeoExecutionResult = {
  outcome: "completed" | "failed" | "paused";
  plan: ExecutionPlan;
  tasks: TaskRecord[];
  state: CeoExecutionState;
  success: boolean;
  error?: string;
  pauseReason?: PauseReason;
  userInputRequest?: UserInputRequest;
  checkpoint?: WorkflowCheckpoint;
};

export interface CeoExecutionRequest {
  projectId: string;
  workflowRunId?: string;
  projectIdea: string;
  projectContext?: ProjectContext;
  userInputValues?: Record<string, unknown>;
}

export interface CeoOrchestratorOptions {
  hooks?: OrchestratorHooks;
  models?: Record<string, ModelConfig>;
  retryPolicy?: RetryPolicy;
  sleepFn?: SleepFunction;
  clock?: Clock;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function toTopologicalOrder(selectedAgents: string[], graph: DependencyGraph) {
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const agent of selectedAgents) {
    indegree.set(agent, 0);
    outgoing.set(agent, []);
  }

  for (const agent of selectedAgents) {
    const dependencies = graph[agent] ?? [];
    for (const dependency of dependencies) {
      if (!indegree.has(dependency)) continue;
      indegree.set(agent, (indegree.get(agent) ?? 0) + 1);
      outgoing.set(dependency, [...(outgoing.get(dependency) ?? []), agent]);
    }
  }

  const queue = selectedAgents
    .filter((agent) => (indegree.get(agent) ?? 0) === 0)
    .sort((a, b) => (agentPriority[a] ?? 99) - (agentPriority[b] ?? 99));

  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);

    const dependents = outgoing.get(current) ?? [];
    for (const dependent of dependents) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        queue.push(dependent);
        queue.sort((a, b) => (agentPriority[a] ?? 99) - (agentPriority[b] ?? 99));
      }
    }
  }

  if (ordered.length !== selectedAgents.length) {
    return [];
  }

  return ordered;
}

export class CEOOrchestrator {
  private readonly pipelines: Pipeline[];
  private readonly agents: AgentDefinition[];
  private readonly models: Record<string, ModelConfig>;
  private readonly hooks?: OrchestratorHooks;
  private readonly retryEngine: RetryEngine;
  private readonly mockResponses: Map<string, unknown[]> = new Map();
  private readonly clock: Clock;

  constructor(
    pipelines: Pipeline[] = defaultPipelines,
    agents: AgentDefinition[] = defaultAgents,
    options: CeoOrchestratorOptions = {},
  ) {
    this.pipelines = pipelines;
    this.agents = agents;
    this.models = options.models ?? defaultModels;
    this.hooks = options.hooks;
    this.retryEngine = new RetryEngine(options.retryPolicy ?? defaultRetryPolicy, options.sleepFn);
    this.clock = options.clock ?? systemClock;
  }

  inspectProjectRequest(projectIdea: string) {
    const normalizedIdea = projectIdea.trim();
    const missingPrerequisites: string[] = [];

    if (normalizedIdea.length < 10) {
      missingPrerequisites.push("projectIdea must be at least 10 characters");
    }

    return {
      ok: missingPrerequisites.length === 0,
      missingPrerequisites,
      normalizedIdea,
    };
  }

  determineExecutionPlan(projectIdea: string): ExecutionPlan {
    const inspection = this.inspectProjectRequest(projectIdea);

    const shouldRunStrategyOnly = /strategy\s+only|strategist\s+only|business\s+plan\s+only/i.test(inspection.normalizedIdea);
    const financialSignals = /(financial|revenue|pricing|cost|budget|funding|profit|break[- ]?even|model)/i.test(inspection.normalizedIdea);

    const selectedAgents = unique([
      "business_strategist",
      ...(shouldRunStrategyOnly ? [] : ["market_research"]),
      ...(shouldRunStrategyOnly ? [] : ["financial_analyst"]),
      ...(financialSignals ? ["financial_analyst"] : []),
    ]);

    const dependencyGraph: DependencyGraph = {};
    for (const agent of selectedAgents) {
      dependencyGraph[agent] = (dependencyTemplate[agent] ?? []).filter((dependency) => selectedAgents.includes(dependency));
    }

    const executionOrder = toTopologicalOrder(selectedAgents, dependencyGraph);
    const expectedArtifacts = selectedAgents.reduce<string[]>((acc, agentId) => {
      const outputModel = this.agents.find((agent) => agent.id === (agentId as AgentID))?.outputModel;
      if (typeof outputModel === "string") {
        acc.push(outputModel);
      }
      return acc;
    }, []);

    const reasoning = [
      "CEO inspects the request and converts it to an executable workflow.",
      "Dependencies are validated before scheduling tasks.",
      "Agent order is computed from the dependency graph rather than hardcoded sequence.",
    ];

    if (shouldRunStrategyOnly) {
      reasoning.push("Request indicates strategy-only scope; downstream research and finance are excluded.");
    } else {
      reasoning.push("Default startup planning scope includes strategy, market intelligence, and financial modeling.");
    }

    if (financialSignals) {
      reasoning.push("Financial intent detected in request; financial_analyst is mandatory.");
    }

    if (!inspection.ok) {
      reasoning.push("Critical prerequisite missing: project idea detail is insufficient.");
    }

    return {
      workflowId: `ceo_dynamic_${selectedAgents.join("_") || "empty"}`,
      selectedAgents,
      executionOrder,
      dependencyGraph,
      reasoning,
      expectedArtifacts,
      currentStatus: "planning",
    };
  }

  validatePrerequisites(plan: ExecutionPlan) {
    const issues: string[] = [];
    if (plan.selectedAgents.length === 0) {
      issues.push("No agents selected for execution.");
    }

    for (const agentId of plan.selectedAgents) {
      const dependencies = plan.dependencyGraph[agentId] ?? [];
      for (const dependency of dependencies) {
        if (!plan.selectedAgents.includes(dependency)) {
          issues.push(`Missing dependency '${dependency}' for agent '${agentId}'.`);
        }
      }
    }

    if (plan.executionOrder.length !== plan.selectedAgents.length) {
      issues.push("Execution order could not be resolved from dependency graph.");
    }

    return {
      ok: issues.length === 0,
      issues,
    };
  }

  registerMockResponse(agentId: string, response: unknown) {
    const queue = this.mockResponses.get(agentId) ?? [];
    queue.push(response);
    this.mockResponses.set(agentId, queue);
  }

  private buildPipelineFromPlan(plan: ExecutionPlan): Pipeline {
    const stepIdByAgent = new Map<string, string>();
    plan.executionOrder.forEach((agentId, index) => {
      stepIdByAgent.set(agentId, `ceo-step-${index + 1}-${agentId}`);
    });

    const steps: PipelineStep[] = plan.executionOrder.map((agentId) => {
      const dependsOnAgents = plan.dependencyGraph[agentId] ?? [];
      const dependsOn = dependsOnAgents.map((dependencyAgent) => stepIdByAgent.get(dependencyAgent)).filter((id): id is string => Boolean(id));
      return {
        id: stepIdByAgent.get(agentId)!,
        agent: agentId as AgentID,
        description: `CEO scheduled execution for ${agentId}`,
        dependsOn,
      };
    });

    return {
      id: plan.workflowId,
      name: "CEO Dynamic Workflow",
      steps,
      requiredAgents: plan.selectedAgents as AgentID[],
      expectedOutputs: plan.expectedArtifacts,
    };
  }

  private emptyState(status: ExecutionPlan["currentStatus"]): CeoExecutionState {
    return {
      status,
      currentAgent: null,
      completedAgents: [],
      failedAgents: [],
      retriesRecommended: [],
      taskStatusByAgent: {},
      attemptCountByAgent: {},
    };
  }

  private async persistExecutionPlan(request: CeoExecutionRequest, plan: ExecutionPlan) {
    const validated = validateModel<ExecutionPlan>("ExecutionPlan", plan);
    if (!validated.success) {
      throw new Error("CEO produced an invalid ExecutionPlan artifact.");
    }

    await globalArtifactStore.save({
      projectId: request.projectId,
      workflowRunId: request.workflowRunId,
      agentId: CEO_AGENT_ID,
      pipelineId: plan.workflowId,
      outputType: "ExecutionPlan",
      content: validated.value,
      validationStatus: "valid",
      version: 1,
      schemaVersion: 1,
      artifactVersion: 1,
    });
  }

  private buildDefaultUserInputFields(): UserInputFieldDefinition[] {
    return [
      {
        key: "additionalContext",
        label: "Additional Context",
        type: "textarea",
        required: true,
        constraints: {
          minLength: 3,
          maxLength: 2000,
        },
      },
    ];
  }

  private buildUserInputRequest(params: {
    workflowRunId: string;
    taskId: string;
    agentId: string;
    question: string;
    context: string;
    requiredFields?: UserInputFieldDefinition[];
  }): UserInputRequest {
    return {
      requestId: `req_${this.clock.nowMs().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      workflowRunId: params.workflowRunId,
      taskId: params.taskId,
      agentId: params.agentId,
      question: params.question,
      context: params.context,
      requiredFields: params.requiredFields ?? this.buildDefaultUserInputFields(),
      createdAt: this.clock.nowISO(),
    };
  }

  private buildCheckpoint(params: {
    workflowRunId: string;
    projectId: string;
    currentTaskId: string;
    completedTaskIds: string[];
    pendingTaskIds: string[];
    dependencyState: Record<string, string[]>;
    attemptCounters: Record<string, number>;
    executionContext: Record<string, unknown>;
    userInputRequest: UserInputRequest;
  }): WorkflowCheckpoint {
    const now = this.clock.nowISO();
    const taskState = new TaskStateMachine("running", params.currentTaskId);
    taskState.transitionTo("waiting_for_user");

    return {
      workflowRunId: params.workflowRunId,
      projectId: params.projectId,
      currentTaskId: params.currentTaskId,
      workflowStatus: "waiting_for_user",
      taskStatus: taskState.status,
      completedTaskIds: params.completedTaskIds,
      pendingTaskIds: params.pendingTaskIds,
      dependencyState: params.dependencyState,
      attemptCounters: params.attemptCounters,
      userInputRequest: params.userInputRequest,
      executionContext: params.executionContext,
      checkpointVersion: 1,
      requestConsumedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async continueExecution(params: {
    request: CeoExecutionRequest;
    runningStatePlan: ExecutionPlan;
    workflowState: WorkflowStateMachine;
    state: CeoExecutionState;
    currentPipeline: Pipeline;
    initialStepOutputs: Record<string, unknown>;
    failedAttemptsByStep: Map<string, number>;
  }): Promise<CeoExecutionResult> {
    const { request, runningStatePlan, workflowState, state } = params;
    let currentPipeline = params.currentPipeline;
    const initialStepOutputs = params.initialStepOutputs;
    const failedAttemptsByStep = params.failedAttemptsByStep;

    const orchestrator = new Orchestrator(
      this.pipelines,
      this.agents,
      this.models,
      {
        onTaskChanged: async (task) => {
          state.currentAgent = task.step.agent;
          state.taskStatusByAgent[task.step.agent] = task.status;
          if (task.status === "completed" && !state.completedAgents.includes(task.step.agent)) {
            state.completedAgents.push(task.step.agent);
          }
          if (task.status === "failed" && !state.failedAgents.includes(task.step.agent)) {
            state.failedAgents.push(task.step.agent);
          }

          if (this.hooks?.onTaskChanged) {
            await this.hooks.onTaskChanged(task);
          }
        },
        onAttemptRecorded: async (task, attempt) => {
          state.attemptCountByAgent[task.step.agent] = attempt.attempt;
          if (this.hooks?.onAttemptRecorded) {
            await this.hooks.onAttemptRecorded(task, attempt);
          }
        },
      },
      {
        taskMaxRetries: 1,
      },
    );

    for (const [agentId, responses] of this.mockResponses.entries()) {
      for (const response of responses) {
        orchestrator.registerMockResponse(agentId, response);
      }
    }

    while (true) {
      const tasks = await orchestrator.startPipeline(
        currentPipeline,
        request.projectId,
        {
          projectSummary: request.projectIdea,
          projectIdea: request.projectIdea,
          projectContext: request.projectContext,
          userInputValues: request.userInputValues,
        },
        request.workflowRunId,
        { initialStepOutputs },
      );

      for (const task of tasks) {
        if (task.status === "completed" && task.result?.output !== undefined) {
          initialStepOutputs[task.step.id] = task.result.output;
        }
      }

      const failedTask = tasks.find((task) => task.status === "failed");
      if (!failedTask) {
        workflowState.transitionTo("completed");
        const completedPlan: ExecutionPlan = {
          ...runningStatePlan,
          currentStatus: workflowState.status,
        };
        state.status = workflowState.status;
        await this.persistExecutionPlan(request, completedPlan);

        return {
          outcome: "completed",
          plan: completedPlan,
          tasks,
          state,
          success: true,
        };
      }

      const lastAttempt = failedTask.attempts[failedTask.attempts.length - 1];
      const previousAttemptCount = failedAttemptsByStep.get(failedTask.step.id) ?? 0;
      const decision = this.retryEngine.decide({
        currentAttempt: previousAttemptCount + 1,
        error: failedTask.result?.error ?? lastAttempt?.error ?? "Execution failed.",
        errorCode: lastAttempt?.error?.code ?? null,
        errorType: lastAttempt?.error?.code ?? null,
        retryableHint: lastAttempt?.error?.retryable,
      });

      if (decision.action === "wait_for_user") {
        failedAttemptsByStep.set(failedTask.step.id, previousAttemptCount + 1);
        workflowState.transitionTo("waiting_for_user");
        const waitPlan: ExecutionPlan = {
          ...runningStatePlan,
          currentStatus: workflowState.status,
          reasoning: [...runningStatePlan.reasoning, decision.reason],
        };
        state.status = workflowState.status;
        await this.persistExecutionPlan(request, waitPlan);

        const failedIndex = currentPipeline.steps.findIndex((step) => step.id === failedTask.step.id);
        const pendingSteps = failedIndex >= 0 ? currentPipeline.steps.slice(failedIndex).map((step) => step.id) : [failedTask.step.id];
        const completedTaskIds = Object.keys(initialStepOutputs).filter((stepId) => !pendingSteps.includes(stepId));
        const dependencyState: Record<string, string[]> = {};
        for (const step of currentPipeline.steps) {
          dependencyState[step.id] = step.dependsOn ?? [];
        }

        const userInputRequest = this.buildUserInputRequest({
          workflowRunId: request.workflowRunId ?? "",
          taskId: failedTask.step.id,
          agentId: failedTask.step.agent,
          question: `Additional input is required for ${failedTask.step.agent}.`,
          context: decision.reason,
        });

        const checkpoint = this.buildCheckpoint({
          workflowRunId: request.workflowRunId ?? "",
          projectId: request.projectId,
          currentTaskId: failedTask.step.id,
          completedTaskIds,
          pendingTaskIds: pendingSteps,
          dependencyState,
          attemptCounters: Object.fromEntries(failedAttemptsByStep.entries()),
          userInputRequest,
          executionContext: {
            plan: runningStatePlan,
            pipeline: currentPipeline,
            initialStepOutputs,
            projectIdea: request.projectIdea,
            projectContext: request.projectContext,
            failedTaskStepId: failedTask.step.id,
          },
        });

        return {
          outcome: "paused",
          pauseReason: "requires_user_input",
          userInputRequest,
          checkpoint,
          plan: waitPlan,
          tasks,
          state,
          success: false,
          error: decision.reason,
        };
      }

      if (decision.action === "fail") {
        failedAttemptsByStep.set(failedTask.step.id, previousAttemptCount + 1);
        workflowState.transitionTo("failed");
        const failedPlan: ExecutionPlan = {
          ...runningStatePlan,
          currentStatus: workflowState.status,
          reasoning: [...runningStatePlan.reasoning, decision.reason],
        };
        state.status = workflowState.status;
        await this.persistExecutionPlan(request, failedPlan);

        return {
          outcome: "failed",
          plan: failedPlan,
          tasks,
          state,
          success: false,
          error: failedTask.result?.error ?? decision.reason,
        };
      }

      failedAttemptsByStep.set(failedTask.step.id, previousAttemptCount + 1);
      state.retriesRecommended.push(failedTask.step.agent);
      workflowState.transitionTo("retrying");
      await this.persistExecutionPlan(request, {
        ...runningStatePlan,
        currentStatus: workflowState.status,
        reasoning: [...runningStatePlan.reasoning, decision.reason],
      });

      await this.retryEngine.wait(decision.delayMs);

      workflowState.transitionTo("running");
      await this.persistExecutionPlan(request, {
        ...runningStatePlan,
        currentStatus: workflowState.status,
      });

      const failedStepIndex = currentPipeline.steps.findIndex((step) => step.id === failedTask.step.id);
      const retrySteps = failedStepIndex >= 0 ? currentPipeline.steps.slice(failedStepIndex) : [failedTask.step];
      currentPipeline = {
        id: `${runningStatePlan.workflowId}_retry_${decision.nextAttempt ?? previousAttemptCount + 1}`,
        name: "CEO Dynamic Workflow Retry",
        steps: retrySteps,
        requiredAgents: retrySteps.map((step) => step.agent),
        expectedOutputs: runningStatePlan.expectedArtifacts,
      };
    }
  }

  async execute(request: CeoExecutionRequest): Promise<CeoExecutionResult> {
    const plan = this.determineExecutionPlan(request.projectIdea);
    const workflowState = new WorkflowStateMachine("planning", request.workflowRunId ?? request.projectId);
    let state = this.emptyState(workflowState.status);

    await this.persistExecutionPlan(request, plan);

    workflowState.transitionTo("running");
    const runningStatePlan: ExecutionPlan = { ...plan, currentStatus: workflowState.status };
    state = this.emptyState(workflowState.status);
    await this.persistExecutionPlan(request, runningStatePlan);

    const inspection = this.inspectProjectRequest(request.projectIdea);
    if (!inspection.ok) {
      workflowState.transitionTo("waiting_for_user");
      const waitingPlan: ExecutionPlan = {
        ...runningStatePlan,
        currentStatus: workflowState.status,
        reasoning: [...runningStatePlan.reasoning, ...inspection.missingPrerequisites],
      };
      state = this.emptyState(workflowState.status);
      await this.persistExecutionPlan(request, waitingPlan);
      const userInputRequest = this.buildUserInputRequest({
        workflowRunId: request.workflowRunId ?? "",
        taskId: "workflow:planning",
        agentId: "ceo_orchestrator",
        question: "Please provide missing required input.",
        context: inspection.missingPrerequisites.join("; "),
      });
      const checkpoint = this.buildCheckpoint({
        workflowRunId: request.workflowRunId ?? "",
        projectId: request.projectId,
        currentTaskId: "workflow:planning",
        completedTaskIds: [],
        pendingTaskIds: runningStatePlan.executionOrder,
        dependencyState: runningStatePlan.dependencyGraph,
        attemptCounters: {},
        userInputRequest,
        executionContext: {
          plan: runningStatePlan,
          pipeline: this.buildPipelineFromPlan(runningStatePlan),
          initialStepOutputs: {},
          projectIdea: request.projectIdea,
          projectContext: request.projectContext,
        },
      });

      return {
        outcome: "paused",
        pauseReason: "requires_user_input",
        userInputRequest,
        checkpoint,
        plan: waitingPlan,
        tasks: [],
        state,
        success: false,
        error: "Critical prerequisites are missing.",
      };
    }

    const prerequisiteCheck = this.validatePrerequisites(runningStatePlan);
    if (!prerequisiteCheck.ok) {
      workflowState.transitionTo("waiting_for_user");
      const waitingPlan: ExecutionPlan = {
        ...runningStatePlan,
        currentStatus: workflowState.status,
        reasoning: [...runningStatePlan.reasoning, ...prerequisiteCheck.issues],
      };
      state = this.emptyState(workflowState.status);
      await this.persistExecutionPlan(request, waitingPlan);
      const userInputRequest = this.buildUserInputRequest({
        workflowRunId: request.workflowRunId ?? "",
        taskId: "workflow:planning",
        agentId: "ceo_orchestrator",
        question: "Please resolve workflow prerequisites.",
        context: prerequisiteCheck.issues.join("; "),
      });
      const checkpoint = this.buildCheckpoint({
        workflowRunId: request.workflowRunId ?? "",
        projectId: request.projectId,
        currentTaskId: "workflow:planning",
        completedTaskIds: [],
        pendingTaskIds: runningStatePlan.executionOrder,
        dependencyState: runningStatePlan.dependencyGraph,
        attemptCounters: {},
        userInputRequest,
        executionContext: {
          plan: runningStatePlan,
          pipeline: this.buildPipelineFromPlan(runningStatePlan),
          initialStepOutputs: {},
          projectIdea: request.projectIdea,
          projectContext: request.projectContext,
        },
      });

      return {
        outcome: "paused",
        pauseReason: "requires_user_input",
        userInputRequest,
        checkpoint,
        plan: waitingPlan,
        tasks: [],
        state,
        success: false,
        error: prerequisiteCheck.issues.join("; "),
      };
    }

    return this.continueExecution({
      request,
      runningStatePlan,
      workflowState,
      state,
      currentPipeline: this.buildPipelineFromPlan(runningStatePlan),
      initialStepOutputs: {},
      failedAttemptsByStep: new Map<string, number>(),
    });
  }

  async resumeFromCheckpoint(checkpoint: WorkflowCheckpoint, values: Record<string, unknown>): Promise<CeoExecutionResult> {
    const executionContext = checkpoint.executionContext as {
      plan?: ExecutionPlan;
      pipeline?: Pipeline;
      initialStepOutputs?: Record<string, unknown>;
      projectIdea?: string;
      projectContext?: ProjectContext;
    };

    const runningStatePlan = executionContext.plan;
  const pipeline = executionContext.pipeline;
    if (!runningStatePlan || !pipeline) {
      return {
        outcome: "failed",
        plan: {
          workflowId: "invalid_checkpoint",
          selectedAgents: [],
          executionOrder: [],
          dependencyGraph: {},
          reasoning: ["Invalid checkpoint execution context."],
          expectedArtifacts: [],
          currentStatus: "failed",
        },
        tasks: [],
        state: this.emptyState("failed"),
        success: false,
        error: "Invalid checkpoint execution context.",
      };
    }

    const pendingSteps = pipeline.steps.filter((step) => checkpoint.pendingTaskIds.includes(step.id));
    const resumedPipeline: Pipeline = pendingSteps.length > 0
      ? {
          ...pipeline,
          steps: pendingSteps,
          requiredAgents: pendingSteps.map((step) => step.agent),
        }
      : pipeline;

    const request: CeoExecutionRequest = {
      projectId: checkpoint.projectId,
      workflowRunId: checkpoint.workflowRunId,
      projectIdea: typeof executionContext.projectIdea === "string" ? executionContext.projectIdea : "",
      projectContext: executionContext.projectContext,
      userInputValues: values,
    };

    const workflowState = new WorkflowStateMachine("waiting_for_user", checkpoint.workflowRunId);
    workflowState.transitionTo("running");
    const state = this.emptyState(workflowState.status);
    await this.persistExecutionPlan(request, {
      ...runningStatePlan,
      currentStatus: workflowState.status,
    });

    return this.continueExecution({
      request,
      runningStatePlan,
      workflowState,
      state,
      currentPipeline: resumedPipeline,
      initialStepOutputs: { ...(executionContext.initialStepOutputs ?? {}) },
      failedAttemptsByStep: new Map<string, number>(Object.entries(checkpoint.attemptCounters ?? {}).map(([k, v]) => [k, Number(v)])),
    });
  }
}

export default CEOOrchestrator;
