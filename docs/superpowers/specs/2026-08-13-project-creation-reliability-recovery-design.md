# Project Creation Reliability & Recovery — Design

**Status:** Approved by owner 2026-08-13, with three adjustments incorporated below
**Branch:** `feat/project-creation-reliability-recovery` (from `master`)
**Batch:** Phase 1 of "Project Creation & Intelligent Intake" — Problems 1–3 only

## Context

Real end-to-end testing of a real project (Eggreen, Amman/Jordan/JOD) on an Android
phone surfaced three defects in the project-creation flow:

1. A valid ISO currency code (JOD) was rejected by client-side validation.
2. Project creation succeeded but starting the AI workflow failed, with no way to
   recover from the resulting generic error.
3. Project history/recovery infrastructure already exists in the repo but is not
   discoverable from the failure state that needs it.

A fourth, much larger problem — building a genuinely adaptive AI intake with a
structured brief, provenance tracking, and Brand Memory integration — was also
raised in the same request. Per owner decision, that is **explicitly out of scope
for this PR** and will be designed separately as Phase 2, once two canonical
product/UX documents referenced by that work are provided. This document governs
Phase 1 only.

## Root causes (confirmed by code audit, not assumption)

### 1. Currency validation
`isValidCurrencyCode` (`src/ai/context/currencyCatalog.ts`) is already a single
function shared by client and server — this was never a client/server duplication
bug. The real defect: it calls `Intl.supportedValuesOf("currency")` and only falls
back to the deterministic, JOD-inclusive `FALLBACK_CURRENCY_CODES` list if that call
*throws*. Some Android WebViews ship a reduced ("small-ICU") dataset where the call
*succeeds* but omits less-common valid codes like JOD, so nothing ever triggers the
fallback and a legitimate code is silently rejected. Node (server, and the existing
test suite) ships full ICU, so this failure mode is invisible today.

### 2. Workflow-start failure
Create and start use two different persistence paths. Create goes through a
session-scoped Supabase RPC, ungated by `AI_PERSISTENCE_PROVIDER`. Start
(`startBusinessStrategistExecution` in `src/lib/project-workflow/service.ts`)
immediately calls `getSystemPersistenceContainer()` → `resolveProvider()`
(`src/lib/persistence/setup.ts`), which throws when `NODE_ENV === "production"`
unless `AI_PERSISTENCE_PROVIDER=supabase` plus `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are set. Next.js sets `NODE_ENV=production` on **both**
Vercel Preview and Production builds (Preview is distinguished by `VERCEL_ENV`, not
`NODE_ENV`), so Preview hits the same strict branch as real Production. If those
vars aren't explicitly scoped to Preview, every start attempt throws before any
write occurs. Confirmed: the throw happens before any persistence write, so the
project row is never deleted or corrupted, and retrying start already reuses the
existing queued run (`ensureQueuedRun`) rather than duplicating it — but nothing in
the codebase currently proves either guarantee via a test, and the failure is
currently indistinguishable from any other 500 in both the API response and the UI.

### 3. Recovery UX
`/projects` and `GET /api/projects/history` already exist, are properly
authenticated and user-scoped, and already return everything needed (name, idea
excerpt, status, workflow state, timestamps, "awaiting input" hint). The
in-workspace `TopNav` already links to `/projects`. The actual gap: the onboarding
wizard's failure state (`CreateProjectWizard.tsx`) renders only a plain-text error
paragraph with no way to act on it — no link, no retry, no indication the project
is safely saved — even though the error message itself tells the user to "try again
from your project history."

## Design decisions

### Currency (`src/ai/context/currencyCatalog.ts`)
Make the checked-in currency list the **sole source of truth** for the
accept/reject decision. Remove `Intl.supportedValuesOf` from the validation path
entirely rather than keeping it as an either/or fallback — this is simpler than a
union approach, fully deterministic across every runtime, and directly satisfies
the requirement that validation must not depend on `Intl.supportedValuesOf`.
`normalizeCurrencyCode` and the existing `Jordan → JOD` suggestion logic
(`currencyResolver.ts`, `budgetTimelineOptions.ts`) are already correct and are not
touched.

### Workflow-start error handling
- Classify persistence-configuration failures distinctly at the
  `/api/projects/start` route boundary — a `503` response with a machine-readable
  code (e.g. `persistence_unavailable`), kept separate from existing 401
  (unauthorized) and 404 (not found) cases, and from a genuinely unexpected 500.
- Add one structured, secret-free server log line when this specific failure
  occurs, so the cause is diagnosable from Vercel logs instead of appearing as an
  anonymous 500.
- Add regression tests proving (a) a failed start never deletes/corrupts the
  project and (b) retrying start reuses the existing queued run instead of
  duplicating it — both true today per the audit, but currently unproven.
- **Not doing:** relaxing `resolveProvider()`'s production-strictness for Preview.
  Preview should behave like production for persistence reliability; fixing the
  actual missing env vars is a Vercel configuration action for the owner, not a
  code change. The exact required Preview env var **names** (no values) will be
  listed in the PR description.

### Recovery UX (`CreateProjectWizard.tsx`)
Replace the current plain-text error paragraph with a stateful recovery panel,
shown only when create succeeded but start failed, using the existing `Button`
component and no ad-hoc styling:
- **Retry Start** (primary) — calls a dedicated start/retry path with the
  already-created `projectId`; uses `Button`'s existing `loading` prop.
  **Invariant (required):** Retry Start must be strictly start-only. It must
  never re-invoke the original create submission and must never call
  `POST /api/projects/create` under any circumstance, including double-click or
  repeated-failure retries. The binding rule for this whole flow is: **one user
  creation → one `projectId` → every retry operates on that same project.** The
  wizard's retry handler calls only the start endpoint directly with the stored
  `projectId`; it does not re-run the create step of the submission flow.
- **Open Project** (secondary) — links to `/workspace/demo?projectId=...`, the
  same destination the existing `/projects` history list already uses for its
  "Open in Workspace" action, so behavior stays consistent across both entry
  points.
- **My Projects** (ghost) — links to `/projects`.
- Explicit copy confirming the project is safely saved, so the user never
  believes creation itself failed.

Distinguish this from a genuine **create failure** (no project persisted — a
simpler error state with no recovery actions, since there is nothing to recover).

The incidental `</p>` typo at `CreateProjectWizard.tsx:243` (noticed during the
audit) is fixed as part of this same edit, since it sits directly in this file's
blast radius.

### My Projects discoverability outside the failure state
The recovery panel and the in-workspace `TopNav` are not sufficient on their own:
a user who has created projects must be able to reach `/projects` through a
normal, always-present route, not only after an error or once already inside the
workspace shell.

**Constraint found during the audit:** there is no existing authenticated
navigation surface to extend cleanly for this. The only two candidates are
`header.tsx` (marketing-only chrome, explicitly off-limits — see below) and
`TopNav`/`WorkspaceLayout` (dark, workspace-specific, project-context-bound
styling built with raw Tailwind classes rather than the semantic design-system
tokens, and only rendered inside `workspace/demo/page.tsx`, not group-wide).
Neither is a clean fit for the onboarding surface, where this problem actually
occurs (a user mid-wizard, e.g. on a phone, has no chrome at all today — the
`(onboarding)` and `(workspace)` route groups have no `layout.tsx` of their own,
unlike `(marketing)`, which is the only group wrapped in `Header`/`Footer`).

**Chosen smallest integration point:** a new `src/app/(onboarding)/layout.tsx`,
scoped only to the onboarding route group (`create-project` and
`create-project/processing`), rendering a minimal, semantic-token-based nav strip
with a single **My Projects** link — shown only when a user session exists
(reusing the existing `getOptionalUser()` pattern already used in `header.tsx`,
not a new auth mechanism). This is additive, isolated from `header.tsx`, isolated
from `TopNav`, uses the project's own semantic color tokens (unlike the legacy raw
Tailwind classes in both of those existing components, which are not modified or
extended), and automatically covers every current and future page in the
onboarding group without per-page wiring. `header.tsx` remains untouched, per the
original isolation requirement.

## Data flow

```
Wizard submit
  → POST /api/projects/create (unchanged)
  → on success: POST /api/projects/start
      → on success: proceed to normal post-start flow (unchanged)
      → on failure: wizard transitions to a local "created, not started" state
          holding the projectId (never lost) and the classified failure reason
          → recovery panel renders
          → "Retry Start" calls only the start endpoint with the same projectId
            (idempotent — reuses the existing queued run; never calls create)
          → repeated failure keeps the panel visible; nothing is silently retried
            or hidden
```

Independently of this failure path, `/projects` is reachable at any time through
the new onboarding-surface nav link described above — not only after a start
failure.

## Testing plan

**Currency**
- JOD, SAR, USD, AED, GBP accepted (client path and server path).
- Fabricated codes (AAA, XYZ, JDO) remain rejected.
- Lowercase input normalizes correctly.
- Jordan suggests JOD.
- Validation result is proven independent of `Intl.supportedValuesOf` by mocking a
  small-ICU-shaped result (present but missing JOD) and asserting JOD is still
  accepted.

**Workflow start**
- A simulated persistence-configuration failure is classified as `503` /
  `persistence_unavailable`, distinct from 401/404/generic 500.
- A failed start does not delete or mutate the created project row.
- Retrying start after a failure reuses the existing queued run — no duplicate
  run or project is created.
- **Repeated Retry Start actions on the same project cannot create another
  project or another workflow run.** This test simulates multiple sequential
  (and, where practical, overlapping) retry calls for one `projectId` and asserts
  exactly one project and one run exist throughout — proving the "one creation →
  one projectId → retries operate on that same project" invariant directly,
  not just as a side effect of the "no duplicate run" case above.
- An unauthorized user cannot start or retry another user's project (extends
  existing tenant-ownership tests; does not weaken them).

**Recovery UX**
- The recovery panel renders only in the create-succeeded/start-failed state, not
  on a plain create failure.
- All three actions use the existing `Button` component with its established
  variant/loading/accessibility contract — no new button styling is introduced.
- "Retry Start" calls only the start endpoint with the correct, already-created
  `projectId`, and a test asserts it never issues a request to
  `/api/projects/create`.

**My Projects discoverability**
- The new onboarding-surface nav renders a "My Projects" link for an
  authenticated user and renders nothing (no broken/empty chrome) for an
  unauthenticated one, mirroring the existing `getOptionalUser()`-gated pattern
  in `header.tsx`.
- The link is present on the core wizard screen and the processing screen (both
  members of the `(onboarding)` route group), independent of any error state.

## Explicit non-goals for this PR

- No adaptive AI intake, structured brief, provenance model, or Brand Memory work
  (all deferred to Phase 2, pending the two canonical documents).
- No changes to `header.tsx` or the marketing nav — the onboarding-surface "My
  Projects" link is a new, isolated file (`(onboarding)/layout.tsx`), not a
  modification of `header.tsx` or `TopNav`.
- No relaxation of Preview's persistence strictness.
- No new dependencies.
- No changes to Production.
- No rewriting of existing Supabase migrations (this PR is not expected to require
  any schema change; if one turns out to be necessary during implementation, it
  will be a new, additive, forward migration only).

## Verification

Standard repository gates (`npm run lint`, `npm run type-check`, `npm test`,
`npm run build`, `git diff --check`) plus the focused tests above, reported
separately. Manual Android/Preview verification (the original failure's exact
device class) is called out explicitly in the PR as a step requiring the owner's
access to the live Preview deployment and a physical/emulated Android device,
which this agent cannot perform directly.
