# Project Creation Reliability & Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the JOD currency-validation bug, make workflow-start failures diagnosable and recoverable without losing or duplicating the created project, and make `/projects` discoverable from the onboarding surface at all times — not only after an error.

**Architecture:** Three independent fixes sharing one root cause pattern (silent, environment-dependent, or unclassified failure) and one regression discipline (prove the fix with a test that would fail against today's code). Currency validation becomes fully deterministic by dropping runtime `Intl` dependence. Workflow-start failures get a distinct, classified error path from persistence configuration through the API response. The onboarding wizard gains a stateful recovery panel and a new, isolated route-group layout for permanent `/projects` discoverability — neither touches `header.tsx`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Vitest, existing `@/components/ui/button` design-system Button, Supabase (persistence, untouched schema).

## Global Constraints

- Branch `feat/project-creation-reliability-recovery` already exists, cut from latest `master` — do not create another branch.
- No new dependencies.
- No changes to `src/components/layout/header.tsx` or the marketing nav.
- No relaxation of `resolveProvider()`'s production-strictness for Preview — only add error *classification*, never change which environments are allowed to run without Supabase.
- Currency validation must never depend on `Intl.supportedValuesOf` for its accept/reject decision.
- Retry Start must call only `POST /api/projects/start` — it must never call `POST /api/projects/create` under any circumstance.
- Invariant: one user creation → one `projectId` → every retry operates on that same project.
- All new interactive UI elements use the existing `Button` component (`@/components/ui/button`) with its established variants (`primary`/`secondary`/`ghost`/`destructive`) — no ad-hoc button styling.
- No changes to Production. No Supabase migrations are expected for this batch; if one turns out to be necessary, it must be a new, additive, forward migration only.
- No Adaptive Intake / Structured Brief / provenance / Brand Memory work in this PR (Phase 2, separate spec).
- Every task ends green on `npm run lint`, `npm run type-check`, and the relevant `npx vitest run <file>` before moving to the next task.

---

### Task 1: Deterministic currency validation

**Files:**
- Modify: `src/ai/context/currencyCatalog.ts` (full rewrite, same exports)
- Test: `src/ai/context/currencyCatalog.test.ts` (append new `describe` block, add `vi` to existing import)

**Interfaces:**
- Consumes: nothing new.
- Produces: `isValidCurrencyCode(value: unknown): value is string`, `normalizeCurrencyCode(value: unknown): string | null`, `listSupportedCurrencyCodes(): readonly string[]` — same signatures as today; no caller elsewhere in the repo needs to change.

- [ ] **Step 1: Write the failing regression tests**

Add `vi` to the existing Vitest import at the top of `src/ai/context/currencyCatalog.test.ts` (change `import { describe, expect, it } from "vitest";` to `import { describe, expect, it, vi } from "vitest";`), then append this new `describe` block at the end of the file, inside the existing outer `describe("currencyCatalog", () => { ... })` block (as a sibling to the existing `describe("isValidCurrencyCode", ...)`, `describe("normalizeCurrencyCode", ...)`, and `describe("listSupportedCurrencyCodes", ...)` blocks, before the final closing `});`):

```ts
  describe("isValidCurrencyCode runtime independence", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("accepts JOD even when Intl.supportedValuesOf returns an incomplete (small-ICU-shaped) list", async () => {
      const original = Intl.supportedValuesOf;
      (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf = (key: string) =>
        key === "currency" ? ["USD", "EUR", "GBP"] : original(key);

      try {
        const { isValidCurrencyCode: freshIsValidCurrencyCode } = await import("./currencyCatalog");
        expect(freshIsValidCurrencyCode("JOD")).toBe(true);
      } finally {
        Intl.supportedValuesOf = original;
      }
    });

    it("accepts JOD even when Intl.supportedValuesOf is unavailable entirely", async () => {
      const original = Intl.supportedValuesOf;
      delete (Intl as unknown as Record<string, unknown>).supportedValuesOf;

      try {
        const { isValidCurrencyCode: freshIsValidCurrencyCode } = await import("./currencyCatalog");
        expect(freshIsValidCurrencyCode("JOD")).toBe(true);
      } finally {
        Intl.supportedValuesOf = original;
      }
    });
  });
```

You also need `beforeEach` in the Vitest import: change it to
`import { beforeEach, describe, expect, it, vi } from "vitest";`.

- [ ] **Step 2: Run the new tests to verify the first one fails**

Run: `npx vitest run src/ai/context/currencyCatalog.test.ts`
Expected: the "accepts JOD even when Intl.supportedValuesOf returns an incomplete... list" test **FAILS** (`expected false to be true`) against the current implementation — this is the exact bug reproduced. The "unavailable entirely" test passes already (the old fallback-on-absence path already worked); that's expected and fine.

- [ ] **Step 3: Rewrite `currencyCatalog.ts` to remove all runtime `Intl` dependence**

Replace the entire contents of `src/ai/context/currencyCatalog.ts` with:

```ts
// Centralized currency validation, shared by onboarding UI, the create
// route, and tests. Never duplicate this list or logic elsewhere.
//
// Validates both shape (3 uppercase letters) AND that the code is a real
// ISO-4217 currency — a bare shape check would accept fabricated codes
// like "AAA"/"XYZ" as if they were real, which is exactly the kind of
// silent-wrong-currency problem this module exists to close.
//
// This list is the single, deterministic source of truth for FIKRA's
// supported currencies. It intentionally does NOT consult
// Intl.supportedValuesOf("currency") at runtime: some Android WebViews
// ship a reduced ("small-ICU") ICU dataset where that API exists and
// succeeds, but silently omits real, valid codes such as JOD. Relying on
// it made currency acceptance depend on which runtime happened to handle
// the request, rejecting currencies FIKRA itself considers valid. This
// checked-in snapshot (captured from Node 24's full ICU data) behaves
// identically on every client, server, and test runtime.

const SUPPORTED_CURRENCY_CODES: ReadonlySet<string> = new Set([
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL",
  "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY",
  "COP", "CRC", "CUC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD",
  "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP",
  "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF", "IDR",
  "ILS", "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS",
  "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR",
  "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP",
  "MRU", "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO",
  "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN",
  "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG",
  "SEK", "SGD", "SHP", "SLE", "SLL", "SOS", "SRD", "SSP", "STN", "SVC",
  "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD",
  "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST",
  "XAF", "XCD", "XCG", "XDR", "XOF", "XPF", "XSU", "YER", "ZAR", "ZMW",
  "ZWG", "ZWL",
]);

const CURRENCY_CODE_SHAPE = /^[A-Z]{3}$/;

export function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
}

export function isValidCurrencyCode(value: unknown): value is string {
  const normalized = normalizeCurrencyCode(value);
  if (!normalized || !CURRENCY_CODE_SHAPE.test(normalized)) return false;
  return SUPPORTED_CURRENCY_CODES.has(normalized);
}

export function listSupportedCurrencyCodes(): readonly string[] {
  return Array.from(SUPPORTED_CURRENCY_CODES).sort();
}
```

- [ ] **Step 4: Run all currency tests to verify everything passes**

Run: `npx vitest run src/ai/context/currencyCatalog.test.ts`
Expected: all tests, old and new, **PASS**.

- [ ] **Step 5: Run lint and type-check**

Run: `npm run lint && npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/ai/context/currencyCatalog.ts src/ai/context/currencyCatalog.test.ts
git commit -m "fix: make currency validation deterministic across runtimes

JOD (and any other checked-in currency) was rejected on Android
WebViews shipping a reduced ICU dataset, because validation preferred
Intl.supportedValuesOf('currency') whenever it existed and succeeded,
even if the result was incomplete. The checked-in currency list is now
the sole source of truth; Intl is no longer consulted for the
accept/reject decision. Adds a regression test that reproduces the
exact small-ICU failure mode against a freshly-imported module."
```

---

### Task 2: Classify persistence-configuration failures

**Files:**
- Modify: `src/lib/persistence/setup.ts:1-74` (add error class, use it in the two throw sites)
- Test: `src/lib/persistence/setup.test.ts` (append assertions on the new error type)

**Interfaces:**
- Consumes: nothing new.
- Produces: `export class PersistenceConfigurationError extends Error` from `src/lib/persistence/setup.ts` — Task 3 imports and catches this by `instanceof`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/persistence/setup.test.ts` (inside the existing `describe("persistence provider safety", ...)` block, after the last `it(...)`, before the closing `});`). First add the new import at the top of the file — change:

```ts
import {
  getPersistenceContainer,
  resetPersistenceContainerForTests,
} from "./setup";
```

to:

```ts
import {
  getPersistenceContainer,
  PersistenceConfigurationError,
  resetPersistenceContainerForTests,
} from "./setup";
```

Then append these two tests:

```ts
  it("throws PersistenceConfigurationError (not a generic Error) when production is missing AI_PERSISTENCE_PROVIDER", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_PERSISTENCE_PROVIDER", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => getPersistenceContainer()).toThrow(PersistenceConfigurationError);
  });

  it("throws PersistenceConfigurationError (not a generic Error) when Supabase credentials are missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PERSISTENCE_PROVIDER", "supabase");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => getPersistenceContainer()).toThrow(PersistenceConfigurationError);
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run src/lib/persistence/setup.test.ts`
Expected: both new tests **FAIL** (import error — `PersistenceConfigurationError` does not exist yet) and/or throw-type assertion failures once the import is stubbed out; the two existing "rejects..." tests (which only check the thrown message via regex) continue to pass.

- [ ] **Step 3: Add the error class and use it at both throw sites**

In `src/lib/persistence/setup.ts`, add this new exported class directly after the imports (before `let globalContainer`):

```ts
export class PersistenceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceConfigurationError";
  }
}
```

Replace the `resolveProvider` function body's three `throw new Error(...)` call sites — there are two inside `resolveProvider` — with `PersistenceConfigurationError`:

```ts
function resolveProvider(): PersistenceProvider {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const configured = process.env.AI_PERSISTENCE_PROVIDER?.trim();

  if (nodeEnv === "test") {
    return "memory";
  }

  if (nodeEnv === "production") {
    if (configured !== "supabase") {
      throw new PersistenceConfigurationError(
        "Production persistence requires AI_PERSISTENCE_PROVIDER=supabase.",
      );
    }

    return "supabase";
  }

  if (!configured || configured === "memory") {
    return "memory";
  }

  if (configured === "supabase") {
    return "supabase";
  }

  throw new PersistenceConfigurationError(
    'AI_PERSISTENCE_PROVIDER must be either "memory" or "supabase".',
  );
}
```

And replace `assertSupabaseConfigured`'s throw:

```ts
function assertSupabaseConfigured() {
  const missing: string[] = [];

  if (!process.env.SUPABASE_URL?.trim()) {
    missing.push("SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missing.length > 0) {
    throw new PersistenceConfigurationError(
      `Supabase persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Missing: ${missing.join(", ")}.`,
    );
  }
}
```

Nothing else in the file changes — `getSystemPersistenceContainer`, `getRequestPersistenceContainer`, and the two exported functions keep their exact current bodies.

**Note on "a failed start never deletes/corrupts the project" (from the design spec):** this task does not add a dedicated runtime test for that specific guarantee. Both throw sites fire on the very first lines of `resolveProvider()`/`assertSupabaseConfigured()`, before `globalContainer` is ever assigned — so `getSystemPersistenceContainer()` never returns a container on this path, and no repository `.update()`/`.create()` call is reachable before the throw. A meaningful runtime test would need `resetPersistenceContainerForTests()` to force `resolveProvider()` to re-run under a production-like stub, but that reset also destroys the in-memory container holding the very project the test would be trying to prove survives — making such a test misleading rather than informative. The guarantee here is structural and verifiable by reading the diff (no write statement was moved or added before either throw), not by a repository-level assertion. Task 4 covers the adjacent, testable guarantee (no duplicate run on retry) that the design spec's owner-approved adjustment specifically asked for.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/persistence/setup.test.ts`
Expected: all tests **PASS**, including the two new ones and the pre-existing message-regex tests (a `PersistenceConfigurationError` is still an `Error`, so `.toThrow(/regex/)` on message content still works unchanged).

- [ ] **Step 5: Run lint and type-check**

Run: `npm run lint && npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/persistence/setup.ts src/lib/persistence/setup.test.ts
git commit -m "fix: classify persistence-configuration failures with a typed error

Adds PersistenceConfigurationError so callers (the /api/projects/start
route, next) can distinguish 'this environment isn't configured for
persistence yet' from an unexpected failure, instead of both surfacing
as an indistinguishable generic Error/500."
```

---

### Task 3: Distinct 503 response for start-time persistence failures

**Files:**
- Modify: `src/app/api/projects/start/route.ts` (full file)
- Test: `src/app/api/projects/start/route.test.ts` (append new tests, no changes to existing ones)

**Interfaces:**
- Consumes: `PersistenceConfigurationError` from `@/lib/persistence/setup` (Task 2).
- Produces: on this specific failure, the route now returns `503` with body `{ error: string, code: "persistence_unavailable" }` instead of the generic `500 { error: "Could not start execution." }`. All other existing response shapes (200/400/401/404/generic 500) are unchanged — Task 5 relies on this.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/api/projects/start/route.test.ts`, inside the existing `describe("projects start route", ...)` block, after test `"11: ..."`, before the closing `});`. First add a new import at the top of the file (after the existing `import { POST } from "./route";` line):

```ts
import { PersistenceConfigurationError } from "@/lib/persistence/setup";
```

Then append:

```ts
  it("12: a PersistenceConfigurationError from the start path produces HTTP 503 with a persistence_unavailable code, not a generic 500", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    startBusinessStrategistExecutionMock.mockRejectedValueOnce(
      new PersistenceConfigurationError("Production persistence requires AI_PERSISTENCE_PROVIDER=supabase."),
    );

    const res = await POST(jsonRequest({ projectId: "proj_test_1" }));
    const body = (await res.json()) as { error?: string; code?: string };

    expect(res.status).toBe(503);
    expect(body.code).toBe("persistence_unavailable");
    expect(typeof body.error).toBe("string");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/persistence/i);

    consoleErrorSpy.mockRestore();
  });

  it("13: the 503 response reassures the user their project is saved and does not leak the raw configuration error text", async () => {
    startBusinessStrategistExecutionMock.mockRejectedValueOnce(
      new PersistenceConfigurationError("Supabase persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Missing: SUPABASE_URL."),
    );

    const res = await POST(jsonRequest({ projectId: "proj_test_1" }));
    const body = (await res.json()) as { error?: string };

    expect(body.error).toMatch(/saved/i);
    expect(body.error).not.toMatch(/SUPABASE_URL/);
  });

  it("14: a generic unexpected error still produces the existing plain 500 (unaffected by the new classification)", async () => {
    startBusinessStrategistExecutionMock.mockRejectedValueOnce(new Error("boom"));

    const res = await POST(jsonRequest({ projectId: "proj_test_1" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Could not start execution." });
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run src/app/api/projects/start/route.test.ts`
Expected: tests 12 and 13 **FAIL** (status is 500, not 503; body has no `code` field). Test 14 already passes against the current code (it's a regression guard for behavior that must not change).

- [ ] **Step 3: Update the route handler**

Replace the entire contents of `src/app/api/projects/start/route.ts` with:

```ts
import { AuthenticationRequiredError, requireAuthenticatedUser } from "@/lib/auth/requireAuthenticatedUser";
import { NextResponse } from "next/server";
import { authorizeProjectStart, ProjectStartAuthorizationError, startBusinessStrategistExecution } from "@/lib/project-workflow/service";
import { PersistenceConfigurationError } from "@/lib/persistence/setup";

export async function POST(req: Request) {
  let projectId: string | undefined;

  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as { projectId?: string };
    projectId = String(body?.projectId ?? "").trim();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    const handoff = await authorizeProjectStart({ userId: user.id }, projectId);
    if (!handoff) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    await startBusinessStrategistExecution(handoff);
    return NextResponse.json({ status: "running" });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 },
      );
    }

    if (error instanceof ProjectStartAuthorizationError) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    if (error instanceof PersistenceConfigurationError) {
      console.error("[api/projects/start] persistence is not configured for this environment", {
        projectId: projectId ?? null,
      });
      return NextResponse.json(
        {
          error:
            "Your project is saved, but the AI workflow could not start because this environment isn't fully configured yet. Please try again shortly.",
          code: "persistence_unavailable",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not start execution." }, { status: 500 });
  }
}
```

The only structural change from before: `projectId` is now declared with `let` before the `try` block (so it is readable inside `catch` for the log line), and one new `if (error instanceof PersistenceConfigurationError)` branch is inserted between the existing `ProjectStartAuthorizationError` branch and the final generic-500 fallback.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/projects/start/route.test.ts`
Expected: all 14 tests **PASS**, including the original 11.

- [ ] **Step 5: Run lint and type-check**

Run: `npm run lint && npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/projects/start/route.ts src/app/api/projects/start/route.test.ts
git commit -m "fix: return 503/persistence_unavailable for persistence-config failures

Distinguishes a misconfigured-environment start failure from a generic
500 at the API boundary, with a secret-free diagnostic log line so the
cause is visible in Vercel logs instead of appearing anonymous."
```

---

### Task 4: Prove repeated Retry Start cannot create a duplicate workflow run

**Files:**
- Test: `src/lib/project-workflow/startBusinessStrategistExecution.test.ts` (append one test; no production code changes — this task locks in an existing guarantee with a test)

**Interfaces:**
- Consumes: `startBusinessStrategistExecution`, `VerifiedProjectHandoff`, `getSystemPersistenceContainer`, `registerHangingProviders`, `seedProject`, `seedQueuedWorkflowRun`, `ORG_A` — all already defined earlier in this same file.
- Produces: nothing new; this is a regression guard.

- [ ] **Step 1: Write the test**

Append to `src/lib/project-workflow/startBusinessStrategistExecution.test.ts`, inside the existing `describe("startBusinessStrategistExecution", ...)` block, after test `"9: ..."`, before the closing `});`:

```ts
  it("10: repeated start calls for the same still-running project never create a second workflow run", async () => {
    const project = await seedProject({ organizationId: ORG_A });
    await seedQueuedWorkflowRun(project.id, "run-fixture-test-10");
    const system = getSystemPersistenceContainer();
    const workflowRunsCreateSpy = vi.spyOn(system.workflowRuns, "create");
    const handoff: VerifiedProjectHandoff = { projectId: project.id, organizationId: ORG_A };

    registerHangingProviders();

    await startBusinessStrategistExecution(handoff);
    await startBusinessStrategistExecution(handoff);
    await startBusinessStrategistExecution(handoff);

    expect(workflowRunsCreateSpy).not.toHaveBeenCalled();

    const runs = await system.workflowRuns.listByProject(project.id);
    expect(runs).toHaveLength(1);
  });
```

This uses `registerHangingProviders()` (already defined above in this file) so the run stays in `queued`/`running` state across all three calls — the exact shape of a real user clicking "Retry Start" multiple times before the first attempt has resolved, which is the scenario the "one creation → one projectId → retries operate on that project" invariant has to hold under.

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx vitest run src/lib/project-workflow/startBusinessStrategistExecution.test.ts`
Expected: all 10 tests **PASS**. This test is expected to pass immediately — `ensureQueuedRun`'s reuse branch and the `runningProjects` dedup guard already provide this guarantee; this step locks it in as an explicit, named regression test rather than an unverified side effect of reading the code.

- [ ] **Step 3: Run lint and type-check**

Run: `npm run lint && npm run type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/project-workflow/startBusinessStrategistExecution.test.ts
git commit -m "test: prove repeated start calls cannot create a duplicate workflow run

Locks in the existing ensureQueuedRun reuse + runningProjects dedup
guarantee as a named regression test for the Retry Start invariant:
one creation -> one projectId -> every retry operates on that project."
```

---

### Task 5: Start-only retry function and projectId on start failures

**Files:**
- Modify: `src/app/(onboarding)/create-project/submitProject.ts` (full file)
- Test: `src/app/(onboarding)/create-project/submitProject.test.ts` (append new tests; no changes to existing ones)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `SubmitProjectResult`'s `ok: false` variant gains an optional `projectId?: string`, always present when `stage === "start"`.
  - New export `export type RetryStartResult = { ok: true } | { ok: false; kind: "auth" | "server" | "unavailable" | "network"; message: string };`
  - New export `export function createProjectStartRetrier(fetchImpl: typeof fetch = fetch): (projectId: string) => Promise<RetryStartResult>` — Task 6 consumes this.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/(onboarding)/create-project/submitProject.test.ts`, after the existing `import` line (`import { initialWizardData, type WizardData } from "./types";`), change the first import line to also bring in the new export:

```ts
import { createProjectStartRetrier, createProjectSubmitter } from "./submitProject";
```

Then append these tests at the end of the file, inside the existing `describe("createProjectSubmitter", ...)` block, right after test `"maps a workflow start failure (500 on the second call) with stage 'start'"`, before its closing `});`:

```ts
  it("includes the created projectId when the start stage fails, so the caller can offer retry", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/projects/create") return jsonResponse(200, { projectId: "proj_test_1" });
      return jsonResponse(500, { error: "Could not start execution." });
    });

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);
    const result = await submit(validData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("start");
      expect(result.projectId).toBe("proj_test_1");
    }
  });

  it("maps a 503 persistence_unavailable start response to kind 'unavailable' with the created projectId", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/projects/create") return jsonResponse(200, { projectId: "proj_test_1" });
      return jsonResponse(503, {
        error: "Your project is saved, but the AI workflow could not start because this environment isn't fully configured yet. Please try again shortly.",
        code: "persistence_unavailable",
      });
    });

    const submit = createProjectSubmitter(fetchImpl as unknown as typeof fetch);
    const result = await submit(validData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("unavailable");
      expect(result.stage).toBe("start");
      expect(result.projectId).toBe("proj_test_1");
      expect(result.message).toMatch(/saved/i);
    }
  });
});

describe("createProjectStartRetrier", () => {
  it("calls only /api/projects/start with the given projectId, never /api/projects/create", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: "running" }));

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const result = await retryStart("proj_test_1");

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects/start");
    expect(JSON.parse(init.body as string)).toEqual({ projectId: "proj_test_1" });

    for (const call of fetchImpl.mock.calls) {
      expect(call[0]).not.toBe("/api/projects/create");
    }
  });

  it("collapses concurrent retry calls into a single in-flight request (double-click safe)", async () => {
    let startCalls = 0;
    const fetchImpl = vi.fn(async () => {
      startCalls += 1;
      return jsonResponse(200, { status: "running" });
    });

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const [first, second] = await Promise.all([retryStart("proj_test_1"), retryStart("proj_test_1")]);

    expect(startCalls).toBe(1);
    expect(first).toEqual(second);
  });

  it("allows a new retry after the previous one has settled", async () => {
    let startCalls = 0;
    const fetchImpl = vi.fn(async () => {
      startCalls += 1;
      return jsonResponse(200, { status: "running" });
    });

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    await retryStart("proj_test_1");
    await retryStart("proj_test_1");

    expect(startCalls).toBe(2);
  });

  it("maps a 503 persistence_unavailable response to kind 'unavailable'", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(503, { error: "Not ready yet.", code: "persistence_unavailable" }),
    );

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const result = await retryStart("proj_test_1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("unavailable");
    }
  });

  it("maps a 401 response to kind 'auth' without leaking response details", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, { error: "Authentication required.", internalTraceId: "trace-xyz" }),
    );

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const result = await retryStart("proj_test_1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("auth");
      expect(result.message).not.toMatch(/trace-xyz/);
    }
  });

  it("maps a network failure to kind 'network'", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const result = await retryStart("proj_test_1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("network");
    }
  });

  it("maps any other non-ok status to kind 'server'", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, { error: "Could not start execution." }));

    const retryStart = createProjectStartRetrier(fetchImpl as unknown as typeof fetch);
    const result = await retryStart("proj_test_1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("server");
    }
  });
});
```

Note: this adds a new closing `});` for the existing `describe("createProjectSubmitter", ...)` block followed by a new `describe("createProjectStartRetrier", ...)` block — make sure the existing file's final `});` (closing the old single describe block) is not duplicated; the two `describe` blocks must be siblings at the top level of the file.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run src/app/(onboarding)/create-project/submitProject.test.ts`
Expected: all the new tests **FAIL** — `createProjectStartRetrier` does not exist yet (import error), and the two new `createProjectSubmitter` assertions on `result.projectId` fail (`undefined` vs expected string).

- [ ] **Step 3: Implement the changes**

Replace the entire contents of `src/app/(onboarding)/create-project/submitProject.ts` with:

```ts
import type { WizardData } from "./types";

export type SubmitProjectResult =
  | { ok: true; projectId: string }
  | {
      ok: false;
      kind: "auth" | "validation" | "network" | "server" | "unavailable";
      stage: "create" | "start";
      message: string;
      // Always present when stage === "start": the project was already
      // created before the failure, so the caller can offer retry/recovery
      // actions against that same project instead of losing track of it.
      projectId?: string;
    };

export type RetryStartResult =
  | { ok: true }
  | { ok: false; kind: "auth" | "server" | "unavailable" | "network"; message: string };

/**
 * Explicit allowlist of fields sent to the API. This is the only place
 * the wizard's in-memory state is serialized for the network, so it is
 * also the enforcement point that no tenant/identity field (userId,
 * organizationId, ownerId, ...) can ever be smuggled onto the wire from
 * client state — the server derives identity from the session cookie.
 */
function buildCreatePayload(data: WizardData) {
  return {
    idea: data.idea,
    businessName: data.businessName,
    industry: data.industry,
    country: data.country,
    city: data.city,
    stage: data.stage,
    audience: data.audience,
    ageRange: data.ageRange,
    customerType: data.customerType,
    goals: data.goals,
    budget: data.budget,
    timeline: data.timeline,
    currency: data.currency,
  };
}

async function readErrorMessage(res: Response): Promise<string | undefined> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload.error;
  } catch {
    return undefined;
  }
}

async function readErrorCode(res: Response): Promise<string | undefined> {
  try {
    const payload = (await res.json()) as { code?: string };
    return payload.code;
  } catch {
    return undefined;
  }
}

async function callStart(projectId: string, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl("/api/projects/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
}

async function performSubmit(data: WizardData, fetchImpl: typeof fetch): Promise<SubmitProjectResult> {
  let createRes: Response;
  try {
    createRes = await fetchImpl("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCreatePayload(data)),
    });
  } catch {
    return {
      ok: false,
      kind: "network",
      stage: "create",
      message: "Network error. Check your connection and try again.",
    };
  }

  if (!createRes.ok) {
    if (createRes.status === 401) {
      return {
        ok: false,
        kind: "auth",
        stage: "create",
        message: "Your session has expired. Please log in again.",
      };
    }

    if (createRes.status === 400) {
      return {
        ok: false,
        kind: "validation",
        stage: "create",
        message: (await readErrorMessage(createRes)) ?? "Please check your project details and try again.",
      };
    }

    return {
      ok: false,
      kind: "server",
      stage: "create",
      message: "Could not create your project. Please try again.",
    };
  }

  const created = (await createRes.json()) as { projectId: string };

  let startRes: Response;
  try {
    startRes = await callStart(created.projectId, fetchImpl);
  } catch {
    return {
      ok: false,
      kind: "network",
      stage: "start",
      projectId: created.projectId,
      message: "Your project was created, but a network error stopped it from starting. Try again from your project history.",
    };
  }

  if (!startRes.ok) {
    if (startRes.status === 401) {
      return {
        ok: false,
        kind: "auth",
        stage: "start",
        projectId: created.projectId,
        message: "Your session has expired. Please log in again.",
      };
    }

    if (startRes.status === 503) {
      return {
        ok: false,
        kind: "unavailable",
        stage: "start",
        projectId: created.projectId,
        message:
          (await readErrorMessage(startRes)) ??
          "Your project was created, but the AI workflow isn't ready to start yet. Please try again shortly.",
      };
    }

    return {
      ok: false,
      kind: "server",
      stage: "start",
      projectId: created.projectId,
      message: "Your project was created, but we couldn't start it. Try again from your project history.",
    };
  }

  return { ok: true, projectId: created.projectId };
}

/**
 * Creates a submit function that collapses concurrent calls into a single
 * in-flight request. Guards against duplicate project creation caused by
 * double-clicks, double form submits, or accidental re-invocation while a
 * submission is already running — the underlying create/start calls are
 * made at most once per submission cycle regardless of how many times the
 * returned function is called while one is pending.
 */
export function createProjectSubmitter(fetchImpl: typeof fetch = fetch) {
  let inFlight: Promise<SubmitProjectResult> | null = null;

  return function submit(data: WizardData): Promise<SubmitProjectResult> {
    if (inFlight) return inFlight;

    inFlight = performSubmit(data, fetchImpl).finally(() => {
      inFlight = null;
    });

    return inFlight;
  };
}

async function performRetryStart(projectId: string, fetchImpl: typeof fetch): Promise<RetryStartResult> {
  let res: Response;
  try {
    res = await callStart(projectId, fetchImpl);
  } catch {
    return {
      ok: false,
      kind: "network",
      message: "Network error. Check your connection and try again.",
    };
  }

  if (!res.ok) {
    if (res.status === 401) {
      return {
        ok: false,
        kind: "auth",
        message: "Your session has expired. Please log in again.",
      };
    }

    if (res.status === 503) {
      const code = await readErrorCode(res);
      return {
        ok: false,
        kind: code === "persistence_unavailable" ? "unavailable" : "server",
        message:
          (await readErrorMessage(res)) ??
          "The AI workflow isn't ready to start yet. Please try again shortly.",
      };
    }

    return {
      ok: false,
      kind: "server",
      message: "Could not start the AI workflow. Please try again.",
    };
  }

  return { ok: true };
}

/**
 * Creates a retry function that calls ONLY the start endpoint for an
 * already-created project. This is the sole client-side entry point for
 * "Retry Start" — it never touches /api/projects/create, so retrying a
 * failed start can never create a second project. Like
 * createProjectSubmitter, concurrent calls collapse into one in-flight
 * request so repeated clicks cannot trigger overlapping start attempts.
 */
export function createProjectStartRetrier(fetchImpl: typeof fetch = fetch) {
  let inFlight: Promise<RetryStartResult> | null = null;

  return function retryStart(projectId: string): Promise<RetryStartResult> {
    if (inFlight) return inFlight;

    inFlight = performRetryStart(projectId, fetchImpl).finally(() => {
      inFlight = null;
    });

    return inFlight;
  };
}
```

Note: `readErrorCode` reads the response body via `res.json()` a second time (after `readErrorMessage` in the 503 branch of `performSubmit` only calls `readErrorMessage`, not `readErrorCode` — so no double-read there). In `performRetryStart`'s 503 branch, both `readErrorCode(res)` and `readErrorMessage(res)` are called on the same `Response`. Since the real `fetch` `Response.json()` can only be consumed once, and the test doubles in this file return a fresh object from `res.json()` on every call (see `jsonResponse` in the test file, which returns a closure — safe to call repeatedly), this works in tests. For the real browser `fetch` Response this would throw on the second `.json()` call — fix this before Step 4 by reading the body once and reusing it:

Replace the 503 branch inside `performRetryStart` with:

```ts
    if (res.status === 503) {
      const payload = await res
        .json()
        .catch(() => undefined as { error?: string; code?: string } | undefined);
      return {
        ok: false,
        kind: payload?.code === "persistence_unavailable" ? "unavailable" : "server",
        message: payload?.error ?? "The AI workflow isn't ready to start yet. Please try again shortly.",
      };
    }
```

and delete the now-unused `readErrorCode` helper function entirely (it is no longer called anywhere).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/(onboarding)/create-project/submitProject.test.ts`
Expected: all tests, old and new, **PASS**.

- [ ] **Step 5: Run lint and type-check**

Run: `npm run lint && npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/(onboarding)/create-project/submitProject.ts src/app/(onboarding)/create-project/submitProject.test.ts
git commit -m "feat: add start-only retry and surface projectId on start failures

createProjectStartRetrier calls only POST /api/projects/start — it has
no code path that can reach /api/projects/create, which is how the
'Retry Start must never create another project' invariant is enforced
structurally, not just by convention. SubmitProjectResult now carries
projectId on every start-stage failure so the UI can offer recovery."
```

---

### Task 6: Recovery panel in the onboarding wizard

**Files:**
- Modify: `src/app/(onboarding)/create-project/CreateProjectWizard.tsx` (targeted edits, not a full rewrite)

**Interfaces:**
- Consumes: `createProjectStartRetrier`, `SubmitProjectResult` (with `projectId`) from Task 5; `Button` from `@/components/ui/button`.
- Produces: nothing new for later tasks — this is a leaf UI change.

- [ ] **Step 1: Add the new imports**

In `src/app/(onboarding)/create-project/CreateProjectWizard.tsx`, change this line:

```ts
import { createProjectSubmitter } from "./submitProject";
```

to:

```ts
import { createProjectStartRetrier, createProjectSubmitter } from "./submitProject";
```

and add a new import for `Button` alongside the other component imports near the top of the file (after the `WizardNavigation` import):

```ts
import { Button } from "@/components/ui/button";
```

- [ ] **Step 2: Add recovery state and the retry ref**

Change this block:

```ts
  const [step, setStep] = useState<number>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [data, setData] = useState<WizardData>(() => loadDraft(userId, initialWizardData));
  const submitRef = useRef(createProjectSubmitter());
```

to:

```ts
  const [step, setStep] = useState<number>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [data, setData] = useState<WizardData>(() => loadDraft(userId, initialWizardData));
  const [failedStartProjectId, setFailedStartProjectId] = useState<string | null>(null);
  const [retryingStart, setRetryingStart] = useState(false);
  const submitRef = useRef(createProjectSubmitter());
  const retryStartRef = useRef(createProjectStartRetrier());
```

- [ ] **Step 3: Update `submit()` to capture the failed-start projectId, and add `handleRetryStart()`**

Change the `submit` function from:

```ts
  async function submit() {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    const result = await submitRef.current(data);

    if (!result.ok) {
      setSubmitError(result.message);
      setSubmitting(false);

      if (result.kind === "auth") {
        router.push(`/login?next=${encodeURIComponent("/create-project")}`);
      }
      return;
    }

    router.push(`/create-project/processing?projectId=${encodeURIComponent(result.projectId)}`);
  }
```

to:

```ts
  async function submit() {
    if (submitting) return;
    setSubmitError(null);
    setFailedStartProjectId(null);
    setSubmitting(true);

    const result = await submitRef.current(data);

    if (!result.ok) {
      setSubmitError(result.message);
      setSubmitting(false);

      if (result.kind === "auth") {
        router.push(`/login?next=${encodeURIComponent("/create-project")}`);
        return;
      }

      if (result.stage === "start" && result.projectId) {
        setFailedStartProjectId(result.projectId);
      }
      return;
    }

    router.push(`/create-project/processing?projectId=${encodeURIComponent(result.projectId)}`);
  }

  async function handleRetryStart() {
    if (!failedStartProjectId || retryingStart) return;
    setRetryingStart(true);
    setSubmitError(null);

    const result = await retryStartRef.current(failedStartProjectId);

    if (!result.ok) {
      setSubmitError(result.message);
      setRetryingStart(false);

      if (result.kind === "auth") {
        router.push(`/login?next=${encodeURIComponent("/create-project")}`);
      }
      return;
    }

    router.push(`/create-project/processing?projectId=${encodeURIComponent(failedStartProjectId)}`);
  }
```

- [ ] **Step 4: Replace the error-display block with the recovery panel**

Change this block near the end of the JSX:

```tsx
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Draft is saved locally on this device only — it is not uploaded until you create your project.
          </p>
          {draftSavedAt ? <p className="text-sm text-emerald-600 dark:text-emerald-400">Draft saved locally.</p> : null}
          {submitError ? <p className="text-sm text-rose-500">{submitError}</p> : null}
          {submitting ? <p className="text-sm text-slate-500">Starting AI workflow...</p> : null}
```

to:

```tsx
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Draft is saved locally on this device only — it is not uploaded until you create your project.
          </p>
          {draftSavedAt ? <p className="text-sm text-emerald-600 dark:text-emerald-400">Draft saved locally.</p> : null}
          {failedStartProjectId ? (
            <div className="space-y-3 rounded-lg border border-border-default bg-surface-subtle p-4">
              <p className="text-sm font-medium text-text-primary">Your project is safely saved.</p>
              <p className="text-sm text-text-secondary">{submitError ?? "The AI workflow hasn't started yet."}</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" loading={retryingStart} onClick={handleRetryStart}>
                  Retry Start
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push(`/workspace/demo?projectId=${encodeURIComponent(failedStartProjectId)}`)}
                >
                  Open Project
                </Button>
                <Button variant="ghost" onClick={() => router.push("/projects")}>
                  My Projects
                </Button>
              </div>
            </div>
          ) : submitError ? (
            <p className="text-sm text-rose-500">{submitError}</p>
          ) : null}
          {submitting ? <p className="text-sm text-slate-500">Starting AI workflow...</p> : null}
```

- [ ] **Step 5: Run lint and type-check**

Run: `npm run lint && npm run type-check`
Expected: no errors. (This component has no existing dedicated test file; behavior is covered indirectly through `submitProject.test.ts` in Task 5. Manual verification of this panel happens in the Preview verification step at the end of this plan.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/(onboarding)/create-project/CreateProjectWizard.tsx"
git commit -m "feat: add recovery panel for create-succeeded/start-failed state

Replaces the plain error paragraph with a stateful panel offering
Retry Start, Open Project, and My Projects using the shared Button
component. Retry Start calls only the new start-only retrier from
submitProject.ts — it never re-invokes project creation."
```

---

### Task 7: My Projects nav on the onboarding surface

**Files:**
- Create: `src/app/(onboarding)/layout.tsx`
- Test: `src/app/(onboarding)/layout.test.ts`

**Interfaces:**
- Consumes: `getOptionalUser` from `@/lib/auth/getOptionalUser` (existing).
- Produces: nothing consumed by other tasks; this is the route-group layout Next.js applies automatically to every page under `(onboarding)`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/(onboarding)/layout.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { getOptionalUserMock } = vi.hoisted(() => ({
  getOptionalUserMock: vi.fn(),
}));

vi.mock("@/lib/auth/getOptionalUser", () => ({
  getOptionalUser: getOptionalUserMock,
}));

import OnboardingLayout from "./layout";

describe("onboarding layout My Projects nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a My Projects link to /projects for an authenticated user", async () => {
    getOptionalUserMock.mockResolvedValue({ id: "user_test_1" });

    const element = await OnboardingLayout({ children: "wizard-content" });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('href="/projects"');
    expect(html).toContain("My Projects");
  });

  it("renders no My Projects link for an unauthenticated visitor", async () => {
    getOptionalUserMock.mockResolvedValue(null);

    const element = await OnboardingLayout({ children: "wizard-content" });
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain("My Projects");
  });

  it("always renders the page content regardless of auth state", async () => {
    getOptionalUserMock.mockResolvedValue(null);

    const element = await OnboardingLayout({ children: "wizard-content-marker" });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("wizard-content-marker");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/(onboarding)/layout.test.ts`
Expected: **FAIL** — `src/app/(onboarding)/layout.tsx` does not exist yet (module not found).

- [ ] **Step 3: Create the layout**

Create `src/app/(onboarding)/layout.tsx`:

```tsx
import Link from "next/link";

import { getOptionalUser } from "@/lib/auth/getOptionalUser";

// Scoped to the (onboarding) route group only (create-project and
// create-project/processing today). header.tsx (marketing-only chrome)
// and TopNav (workspace-only, dark-themed, raw-Tailwind-styled) are both
// deliberately not extended for this — see
// docs/superpowers/specs/2026-08-13-project-creation-reliability-recovery-design.md
// for why neither was a clean fit. This gives an authenticated user a
// normal, always-present route to /projects independent of any error
// state or of already being inside the workspace shell.
export default async function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getOptionalUser();

  return (
    <>
      {user ? (
        <div className="border-b border-border-default bg-surface-canvas px-4 py-2 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-4xl justify-end">
            <Link
              href="/projects"
              className="text-sm font-medium text-text-secondary transition hover:text-text-primary focus-visible:outline focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-[color:var(--color-border-focus)]"
            >
              My Projects
            </Link>
          </div>
        </div>
      ) : null}
      <main className="flex-1">{children}</main>
    </>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/(onboarding)/layout.test.ts`
Expected: all 3 tests **PASS**.

- [ ] **Step 5: Run lint and type-check**

Run: `npm run lint && npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(onboarding)/layout.tsx" "src/app/(onboarding)/layout.test.ts"
git commit -m "feat: add My Projects nav to the onboarding route group

Gives an authenticated user a normal, always-present route to
/projects from the wizard and processing screens, independent of any
error state and without touching header.tsx or TopNav — neither was a
clean extension point (see the design spec for the constraint this
resolves)."
```

---

### Task 8: Full verification pass

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Run the full repository gates**

Run, in order, stopping to fix and re-run if any step fails before continuing to the next:

```bash
npm run lint
npm run type-check
npm test
npm run build
git diff --check
```

Expected: all five succeed with no errors and no output from `git diff --check`.

- [ ] **Step 2: Run the full focused-test set together and record the totals**

Run:

```bash
npx vitest run \
  src/ai/context/currencyCatalog.test.ts \
  src/lib/persistence/setup.test.ts \
  src/app/api/projects/start/route.test.ts \
  src/lib/project-workflow/startBusinessStrategistExecution.test.ts \
  "src/app/(onboarding)/create-project/submitProject.test.ts" \
  "src/app/(onboarding)/layout.test.ts"
```

Expected: all suites pass. Record the total pass count reported by Vitest for the PR description.

- [ ] **Step 3: Confirm no unrelated files changed**

Run: `git status --short` and `git diff --stat master...HEAD`
Expected: only the files touched by Tasks 1–7 appear — no changes to `header.tsx`, no changes outside this batch's scope, no changes to any file under `docs/brand/`.

- [ ] **Step 4: Commit any final formatting fixups only if the gates required them**

If Step 1 required any auto-fixable formatting changes not already committed in their originating task, commit them now with:

```bash
git add -A
git commit -m "chore: apply lint/format fixes from final verification pass"
```

If nothing changed, skip this step — do not create an empty commit.

---

## Post-plan: manual Preview verification (owner, not this agent)

This plan cannot verify the following itself — no live Vercel Preview access and no physical/emulated Android device are available in this environment. Once the branch is pushed and a Preview deployment exists, verify manually:

- **Preview environment variables required** (names only, confirm these are set in the Preview scope in Vercel, not just Production): `AI_PERSISTENCE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. If they are missing, `/api/projects/start` will return the new `503 persistence_unavailable` response instead of the old anonymous `500` — confirm the recovery panel renders correctly for that case as part of this same check.
- **Android**: Jordan → JOD suggestion and manual JOD entry both accepted on step 5 of the wizard; a simulated start failure shows the recovery panel with all three actions reachable and tappable at typical mobile viewport widths; the My Projects link in the new onboarding nav is reachable without scrolling issues.
- **Desktop**: same flow, plus confirm `/projects` is reachable from the onboarding surface even when no error has occurred (open the wizard fresh, click "My Projects" before submitting anything).
- **Recovery correctness**: trigger a real start failure (or the 503 case above), click "Retry Start" more than once quickly, and confirm in `/projects` / Supabase that exactly one project and one workflow run exist for that attempt — no duplicates.
