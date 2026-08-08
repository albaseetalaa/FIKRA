import type { WizardData } from "./types";

export type SubmitProjectResult =
  | { ok: true; projectId: string }
  | {
      ok: false;
      kind: "auth" | "validation" | "network" | "server";
      stage: "create" | "start";
      message: string;
    };

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
    startRes = await fetchImpl("/api/projects/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: created.projectId }),
    });
  } catch {
    return {
      ok: false,
      kind: "network",
      stage: "start",
      message: "Your project was created, but a network error stopped it from starting. Try again from your project history.",
    };
  }

  if (!startRes.ok) {
    if (startRes.status === 401) {
      return {
        ok: false,
        kind: "auth",
        stage: "start",
        message: "Your session has expired. Please log in again.",
      };
    }

    return {
      ok: false,
      kind: "server",
      stage: "start",
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
