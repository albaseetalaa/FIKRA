# AI Architecture

This directory contains the shared AI execution foundation used by Fikra AI.

The architecture coordinates agent registration, execution planning, provider calls, structured output handling, validation, reliability policies, and artifact persistence.

## Execution Flow

The canonical execution path is:

```text
CEO Orchestrator
    ↓
Execution Plan
    ↓
Agent Registry
    ↓
Agent Factory
    ↓
Shared Agent Lifecycle
    ↓
Provider Invocation
    ↓
Response Normalization
    ↓
Structural and Semantic Validation
    ↓
Repair or Retry
    ↓
Artifact Persistence
```

Agent-specific branching should not be added directly to the orchestrator runtime. New agents should be registered through the Agent SDK.

## Current Agents

The current implementation includes:

- Business Strategist
- Market Research
- Financial Analyst

The CEO orchestrator can plan and execute registered agents according to dependencies and project context.

## Directory Structure

- `agents` — agent definitions and runtime metadata
- `ceo` — CEO planning and dynamic orchestration
- `context` — project context normalization and business classification
- `contracts` — output contracts and artifact requirements
- `normalization` — provider response normalization
- `pipelines` — predefined execution pipelines
- `prompts` — agent prompt construction
- `providers` — provider adapters, model configuration, and response parsing
- `reliability` — retry, timeout, pause, resume, and error classification
- `schemas` — structured output schemas
- `sdk` — agent registry, factory, lifecycle, permissions, and templates
- `store` — artifact persistence abstractions
- `testing` — AI architecture and regression tests
- `validation` — structural diagnostics and semantic validation
- `workflow` — workflow state transitions

## Agent SDK

The Agent SDK is the canonical runtime path for agent execution.

It provides:

- Agent registration
- Agent construction
- Dependency declarations
- Capability declarations
- Output contract registration
- Shared execution lifecycle
- Structural validation
- Semantic validation
- Repair handling
- Persistence integration
- Pause and resume compatibility

Detailed instructions for adding an agent are available in:

```text
src/ai/sdk/README.md
```

## Providers

Provider-specific behavior must remain behind provider adapters.

The current architecture includes:

- OpenAI provider support
- Mock providers for deterministic testing
- Structured response handling
- Output-token budgets
- Response parsing guardrails
- Provider error classification

Provider output must not be persisted until it passes the required validation stages.

## Validation and Repair

Agent output can pass through:

1. Provider response parsing
2. Response normalization
3. Schema validation
4. Semantic validation
5. Validation-aware repair
6. Final artifact persistence

Malformed, incomplete, truncated, or semantically invalid outputs must not be silently accepted.

## Reliability

The reliability layer supports:

- Retry policies
- Timeout handling
- Provider failure classification
- Failure isolation
- Validation-aware repair attempts
- Workflow pause and resume
- Recovery without rerunning completed tasks
- Attempt persistence

Downstream tasks should not run when required dependencies permanently fail.

## Persistence

AI artifacts and workflow attempts can be stored using:

- In-memory persistence
- Supabase persistence

Persistence configuration is controlled through:

```env
AI_PERSISTENCE_PROVIDER=memory
```

Supabase migration and setup instructions are available in:

```text
supabase/README.md
```

## Adding a New Agent

A new agent should normally include:

- Agent definition
- Output contract
- Semantic validator
- Deterministic test fixture
- Registry configuration
- Dependency declarations
- Capability declarations
- Lifecycle tests
- Validation and repair tests
- Orchestrator regression tests
- Persistence and resume tests when applicable

Adding a registered agent should not require agent-specific changes to the shared orchestrator runtime.

## Testing

Run the complete test suite with:

```bash
npm test
```

The AI tests cover areas including:

- Agent registry and factory behavior
- SDK lifecycle policies
- CEO orchestration
- Dependency execution
- Structured provider output
- Parsing guardrails
- Structural validation
- Semantic validation
- Repair attempts
- Retry and timeout behavior
- Failure isolation
- Pause and resume
- Artifact persistence
- Attempt persistence
- Cross-vertical regression

Supabase integration tests must be run separately and must not run concurrently.