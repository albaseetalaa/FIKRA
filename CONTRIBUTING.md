# Contributing to Fikra AI

This document defines the required workflow, quality checks, and engineering rules for changes to the Fikra AI repository.

## Requirements

- Node.js 18.18 or newer
- npm
- Git
- Supabase CLI when working with migrations or local Supabase

GitHub Actions currently uses Node.js 20.

## Initial Setup

Clone the repository:

```bash
git clone https://github.com/albaseetalaa/FIKRA.git
cd FIKRA
```

Install the exact dependency versions from `package-lock.json`:

```bash
npm ci
```

Create the local environment file.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

On macOS or Linux:

```bash
cp .env.example .env.local
```

Add the required local values, then start the application:

```bash
npm run dev
```

## Production Branch

The repository currently uses:

```text
master
```

Do not develop directly on `master`.

Create a focused branch from the latest `master`:

```bash
git switch master
git pull --ff-only
git switch -c <type>/<short-name>
```

Supported branch prefixes include:

```text
feature/
fix/
chore/
docs/
refactor/
test/
ci/
```

Examples:

```text
feature/marketing-strategist
fix/workflow-attempt-numbering
docs/project-governance
ci/update-quality-checks
```

Keep each branch focused on one concern.

## Commit Messages

Use Conventional Commits-style messages:

```text
<type>: <short summary>
```

Common types:

```text
feat
fix
docs
chore
refactor
test
ci
```

Examples:

```text
feat: add marketing strategist agent
fix: prevent duplicate workflow attempts
docs: update AI architecture
ci: run quality checks on master
```

Commit messages should describe the actual change, not the editing process.

## Required Local Checks

Before opening a pull request, run these commands separately:

```bash
npm run lint
npm run type-check
npm test
npm run build
```

All four commands must complete successfully.

The current CI workflow runs the same quality sequence after installing dependencies with `npm ci`.

## Formatting

Prettier is available through:

```bash
npm run format
npm run format:check
```

The repository is not currently fully normalized to the active Prettier configuration.

Do not run repository-wide formatting as part of an unrelated feature, fix, or documentation change.

A repository-wide formatting change must use a dedicated branch and pull request so functional changes remain reviewable.

## Testing Rules

- Add or update tests for behavior changed by the pull request
- Do not weaken existing assertions merely to make a test pass
- Do not replace realistic fixtures with incomplete placeholders
- Preserve regression coverage for previously fixed defects
- Test failure paths as well as successful execution paths
- Verify persistence, retry, repair, and resume behavior when those areas change
- Run the full suite before opening a pull request

Supabase integration tests must be run separately and must not run concurrently.

## Agent SDK Rules

The Agent SDK is the canonical runtime path for agent execution.

Adding a new agent should not require agent-specific branching inside the orchestrator runtime.

A new agent should normally include:

- Agent definition
- Output contract
- Semantic validator
- Deterministic fixture
- Registry configuration
- Lifecycle tests
- Validation and repair tests
- Orchestrator regression coverage
- Persistence and resume coverage when applicable

Detailed guidance is available in:

```text
src/ai/sdk/README.md
```

## Architecture Rules

- Keep route and page code in `src/app`
- Keep shared interface components in `src/components`
- Keep reusable application logic in `src/lib`
- Keep AI execution code in `src/ai`
- Keep shared TypeScript types in `src/types`
- Keep Supabase migrations in `supabase/migrations`
- Prefer Server Components unless browser state, interactivity, or browser-only APIs are required
- Avoid `any`; use explicit TypeScript types
- Do not bypass shared validation, reliability, or persistence layers
- Do not persist structurally invalid agent artifacts
- Keep provider-specific behavior behind provider adapters
- Declare required external access through agent capabilities

## Environment Variables

Use `.env.example` as the canonical reference.

Rules:

- Never commit `.env.local`
- Never commit real credentials
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code
- Only `NEXT_PUBLIC_` variables may be exposed to the browser
- Add every new variable to `.env.example`
- Add runtime variables to the Zod schema in `src/lib/env.ts`
- Configure required production variables in Vercel separately

Do not paste secrets into pull requests, issues, logs, screenshots, or test fixtures.

## Dependency Changes

When adding or updating dependencies:

- Explain why the dependency is required
- Prefer the smallest suitable dependency
- Review direct and transitive security impact
- Commit the updated `package-lock.json`
- Run the complete quality suite
- Do not use `npm audit fix --force` without reviewing breaking changes
- Do not merge automatic dependency changes solely because installation succeeds

## Pull Requests

Every pull request should:

- Target `master`
- Address one focused concern
- Explain what changed and why
- List relevant validation performed
- Include tests for changed behavior
- Avoid unrelated formatting or refactoring
- Pass GitHub Actions
- Pass Vercel checks when applicable
- Contain no secrets or local environment files

Use squash merge after review and successful checks.

A suitable pull request description includes:

```markdown
## Summary

- Describe the main change
- Describe important supporting changes

## Validation

- `npm run lint`
- `npm run type-check`
- `npm test`
- `npm run build`
```

## Review Expectations

Review should verify:

- Correctness
- Architectural consistency
- Test coverage
- Failure handling
- Security boundaries
- Environment-variable safety
- Persistence behavior
- Backward compatibility
- Absence of unrelated changes

Large or risky changes should be divided into smaller reviewable pull requests.

## Supabase Changes

For database changes:

- Create a new migration under `supabase/migrations`
- Do not edit an already-applied production migration
- Review destructive operations carefully
- Keep service-role usage server-only
- Test migration behavior against an appropriate environment
- Document new runtime variables
- Keep integration tests isolated from the regular parallel test suite

Supabase instructions are available in:

```text
supabase/README.md
```

## Documentation

Update documentation when a change affects:

- Setup commands
- Environment variables
- Architecture
- Agent registration
- Persistence
- Database migrations
- Testing procedures
- Deployment
- Contribution workflow

Documentation must describe the current implementation rather than planned or obsolete behavior.

## Reporting Issues

A useful issue report should include:

- Clear problem description
- Steps to reproduce
- Expected behavior
- Actual behavior
- Relevant logs with secrets removed
- Browser and operating system when relevant
- Node.js version
- Related project or workflow identifiers when safe to share

## Final Checklist

Before requesting merge, confirm:

```text
[ ] The branch is based on the latest master
[ ] The change is focused
[ ] No secrets are included
[ ] Environment documentation is updated
[ ] Tests cover the changed behavior
[ ] npm run lint passes
[ ] npm run type-check passes
[ ] npm test passes
[ ] npm run build passes
[ ] GitHub Actions passes
[ ] Vercel checks pass when applicable
[ ] The pull request description is complete
```