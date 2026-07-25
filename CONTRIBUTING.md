# Contributing to Fikra AI

Thanks for contributing. This document covers the workflow, standards, and
checks every change is expected to pass.

## Prerequisites

- Node.js 18.18+ (see `engines` in `package.json`)
- npm

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Branching

- `main` is protected and always deployable.
- Branch from `main` using a short, descriptive name:
  `feature/<name>`, `fix/<name>`, `chore/<name>`.
- Keep branches focused on a single change; open a PR early if the work
  will take more than a day.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short summary>

[optional body]
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.

Example: `feat: add project settings page`

## Before opening a PR

Run these locally — the same checks run in CI and must pass before merge:

```bash
npm run lint
npm run type-check
npm run build
npm run format:check
```

## Pull requests

- Keep PRs small and scoped to one concern.
- Describe what changed and why; link any related issue.
- Ensure CI is green before requesting review.
- Squash-merge once approved, using a Conventional Commits-style title.

## Code style

- TypeScript strict mode is enforced — avoid `any`; prefer explicit types.
- Formatting is handled by Prettier (`npm run format`) — don't hand-format.
- Follow the existing folder structure described in `README.md`:
  route/UI code in `src/app`, shared UI in `src/components`, framework-
  agnostic logic in `src/lib`, shared types in `src/types`.
- Prefer Server Components by default; only add `"use client"` when the
  component needs interactivity, state, or browser-only APIs.

## Environment variables

- Never commit `.env.local` or real secrets.
- When adding a new environment variable, update `.env.example` and, if
  it's required at runtime, add it to the Zod schema in `src/lib/env.ts`.

## Reporting issues

Open a GitHub issue with steps to reproduce, expected vs. actual behavior,
and environment details (browser, Node version) where relevant.
