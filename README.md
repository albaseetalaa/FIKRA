# Fikra AI

Fikra AI is a Next.js application for transforming business ideas into structured outputs through coordinated AI agents.

The current codebase includes a shared Agent SDK, a CEO-style orchestrator, structured-output validation, reliability policies, workflow persistence, project APIs, automated tests, and continuous integration.

## Current Capabilities

The implemented foundation includes:

- Business project creation and processing workflows
- Business Strategist agent
- Market Research agent
- Financial Analyst agent
- CEO-driven execution planning
- Shared Agent SDK and agent registry
- Agent factory and shared execution lifecycle
- Structured output contracts
- JSON parsing and normalization
- Schema validation
- Semantic validation
- Validation-aware output repair
- Retry and timeout handling
- Agent dependency management
- Failure isolation between workflow steps
- Pause and resume workflow support
- Artifact and attempt persistence
- In-memory persistence
- Supabase persistence
- Project history and workflow status APIs
- Automated GitHub Actions checks

New agents should be registered through the Agent SDK without adding agent-specific branching logic to the orchestrator runtime.

## Technology Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint 9
- Prettier
- Vitest
- Zod
- OpenAI SDK
- Supabase
- GitHub Actions
- Vercel

## Requirements

- Node.js 20.9 or newer
- npm
- Git
- Supabase CLI when working with migrations or local Supabase

GitHub Actions currently uses Node.js 20.

## Local Setup

Clone the repository:

```bash
git clone https://github.com/albaseetalaa/FIKRA.git
cd FIKRA
```

Install the exact dependency versions from `package-lock.json`:

```bash
npm ci
```

Create a local environment file.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

On macOS or Linux:

```bash
cp .env.example .env.local
```

Add the required local environment values, then start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server with Turbopack |
| `npm run build` | Create an optimized production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with automatic fixes |
| `npm run type-check` | Run TypeScript validation without emitting files |
| `npm test` | Run the complete Vitest suite once |
| `npm run format` | Format supported files with Prettier |
| `npm run format:check` | Check formatting without changing files |

The repository is not currently fully normalized to the active Prettier configuration. Repository-wide formatting should be handled in a dedicated branch and should not be mixed with functional changes.

## Project Structure

```text
FIKRA/
├── .github/
│   └── workflows/
│       └── ci.yml
├── public/
├── src/
│   ├── ai/
│   │   ├── agents/
│   │   ├── ceo/
│   │   ├── context/
│   │   ├── contracts/
│   │   ├── normalization/
│   │   ├── pipelines/
│   │   ├── prompts/
│   │   ├── providers/
│   │   ├── reliability/
│   │   ├── schemas/
│   │   ├── sdk/
│   │   ├── store/
│   │   ├── testing/
│   │   ├── validation/
│   │   └── workflow/
│   ├── app/
│   │   ├── api/
│   │   ├── create-project/
│   │   ├── projects/
│   │   └── workspace/
│   ├── components/
│   ├── lib/
│   │   ├── persistence/
│   │   ├── project-workflow/
│   │   ├── supabase/
│   │   └── time/
│   └── types/
├── supabase/
│   ├── migrations/
│   └── README.md
├── .env.example
├── CONTRIBUTING.md
├── middleware.ts
├── next.config.ts
├── package-lock.json
├── package.json
└── tsconfig.json
```

## AI Execution Architecture

The shared execution path is:

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
Normalization
    ↓
Structural and Semantic Validation
    ↓
Repair or Retry Policy
    ↓
Artifact Persistence
```

The Agent SDK is the canonical runtime path for agent execution.

Detailed Agent SDK guidance is available in:

```text
src/ai/sdk/README.md
```

## Persistence

Fikra AI supports the following persistence providers:

```text
memory
supabase
```

The provider is selected through:

```env
AI_PERSISTENCE_PROVIDER=memory
```

For Supabase persistence:

```env
AI_PERSISTENCE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Database migrations are stored in:

```text
supabase/migrations
```

Supabase setup and migration instructions are documented in:

```text
supabase/README.md
```

## Environment Variables

Use `.env.example` as the canonical environment-variable reference.

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

AI_PERSISTENCE_PROVIDER=memory
RUN_SUPABASE_INTEGRATION_TESTS=false
```

Environment rules:

- Never commit `.env.local`
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code
- Only variables prefixed with `NEXT_PUBLIC_` may be exposed to the browser
- Add every new environment variable to `.env.example`
- Add runtime environment variables to the Zod schema in `src/lib/env.ts`

## Testing

Run the complete test suite:

```bash
npm test
```

The current test suite covers areas including:

- Agent registry behavior
- Agent factory behavior
- Agent SDK lifecycle policies
- Output contract registration
- Provider structured outputs
- Response parsing guardrails
- Schema validation
- Semantic validation
- Validation-aware repair
- Retry behavior
- Timeout handling
- Failure isolation
- CEO orchestration
- Dynamic agent execution
- Pause and resume workflows
- Persistence contracts
- Supabase retry classification
- Cross-vertical regression
- Project workflow calculations
- API route behavior

Supabase integration tests should be run separately and must not be executed concurrently.

## Local Quality Checks

Before opening a pull request, run:

```bash
npm run lint
npm run type-check
npm test
npm run build
```

All four commands must complete successfully before merge.

## Continuous Integration

GitHub Actions runs for pushes and pull requests targeting `master`.

The CI workflow performs:

```text
npm ci
npm run lint
npm run type-check
npm test
npm run build
```

The workflow uses read-only repository permissions.

## Branching

The repository currently uses:

```text
master
```

Create a focused branch for each change.

Examples:

```text
feature/<name>
fix/<name>
chore/<name>
docs/<name>
refactor/<name>
test/<name>
ci/<name>
```

Use Conventional Commits-style messages:

```text
feat: add marketing strategist agent
fix: prevent duplicate workflow attempts
docs: update project architecture
ci: run quality checks on master
```

Pull requests should remain focused, pass all automated checks, and be squash-merged after review.

See `CONTRIBUTING.md` for the contribution workflow.

## Security

- Never commit secrets or local environment files
- Keep service-role credentials in server-only code
- Validate agent outputs before persistence
- Do not silently accept structurally invalid artifacts
- Require external API access through declared agent capabilities
- Keep GitHub Actions permissions minimal
- Review dependency vulnerabilities before applying automated breaking updates
- Do not use `npm audit fix --force` without reviewing the dependency changes

## Deployment

The application is connected to Vercel.

A deployment should use:

```bash
npm run build
```

Before release:

1. Confirm GitHub Actions passes
2. Confirm the Vercel deployment check passes
3. Confirm required environment variables are configured
4. Confirm no secrets are included in the repository
5. Confirm the target commit is present on `master`

## Documentation

- `README.md` — project overview and setup
- `CONTRIBUTING.md` — contribution workflow and standards
- `src/ai/README.md` — AI architecture overview
- `src/ai/sdk/README.md` — Agent SDK extension guide
- `supabase/README.md` — Supabase migrations and operations

## Verified Baseline

The current verified baseline includes:

- TypeScript validation passed
- ESLint validation passed
- 45 test files passed
- 219 tests passed
- Next.js production build passed
- Local application startup passed
- GitHub Actions checks passed on `master`

Future agents and product modules should build on the existing Agent SDK and shared execution foundation rather than bypassing them.

## Production persistence safety

Automated tests always use in-memory persistence. Local development may use
`AI_PERSISTENCE_PROVIDER=memory`.

Production must set:

- `AI_PERSISTENCE_PROVIDER=supabase`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Fikra fails explicitly when production persistence is missing or incomplete.
It does not silently store customer work in temporary process memory.
