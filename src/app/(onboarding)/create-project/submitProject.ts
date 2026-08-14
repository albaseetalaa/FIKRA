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
      // A single res.json() read, reused for both fields — Response.json()
      // can only be consumed once on a real fetch Response, so this must
      // not call two separate helpers that each read the body.
      const payload = await res
        .json()
        .catch(() => undefined as { error?: string; code?: string } | undefined);
      return {
        ok: false,
        kind: payload?.code === "persistence_unavailable" ? "unavailable" : "server",
        message: payload?.error ?? "The AI workflow isn't ready to start yet. Please try again shortly.",
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
