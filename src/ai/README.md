AI Architecture
==============

This folder contains the core AI architecture scaffolding: agents, prompts, pipelines, providers, types, utilities and a basic orchestrator. It is intentionally provider-agnostic and contains no external API calls.

Structure
- `agents` — agent definitions and metadata
- `pipelines` — pre-defined AI pipelines composed of agent steps
- `prompts` — prompt templates per agent and a tiny renderer
- `providers` — provider adapter interfaces and noop provider
- `types` — TypeScript interfaces for agents and outputs
- `orchestrator` — simple task orchestrator to run pipelines and track progress
- `utils` — helpers such as logging

Integration points:
- Implement `AIProvider` adapters in `providers/` for OpenAI, Anthropic, Gemini, etc.
- Replace `Orchestrator.runAgent` implementation to call providers and validate outputs.
