import {
  InMemoryArtifactStoreV2,
  InMemoryAttemptRepository,
  InMemoryProjectRepository,
  InMemoryWorkflowCheckpointRepository,
  InMemoryWorkflowRunRepository,
  InMemoryWorkflowTaskRepository,
} from "./memory/repositories";
import type { PersistenceContainer } from "./interfaces";
import { createAdminClient } from "../supabase/admin";
import {
  SupabaseArtifactStore,
  SupabaseAttemptRepository,
  SupabaseProjectRepository,
  SupabaseWorkflowCheckpointRepository,
  SupabaseWorkflowRunRepository,
  SupabaseWorkflowTaskRepository,
} from "./supabase/repositories";
import type { PersistenceProvider } from "./types";

let globalContainer: PersistenceContainer | null = null;

function resolveProvider(): PersistenceProvider {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const configured = process.env.AI_PERSISTENCE_PROVIDER?.trim();

  if (nodeEnv === "test") {
    return "memory";
  }

  if (nodeEnv === "production") {
    if (configured !== "supabase") {
      throw new Error(
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

  throw new Error(
    'AI_PERSISTENCE_PROVIDER must be either "memory" or "supabase".',
  );
}

function assertSupabaseConfigured() {
  const missing: string[] = [];

  if (!process.env.SUPABASE_URL?.trim()) {
    missing.push("SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Supabase persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Missing: ${missing.join(", ")}.`,
    );
  }
}

export function resetPersistenceContainerForTests() {
  globalContainer = null;
}

export function getPersistenceContainer(): PersistenceContainer {
  if (globalContainer) {
    return globalContainer;
  }

  const provider = resolveProvider();

  if (provider === "supabase") {
    assertSupabaseConfigured();

    const db = createAdminClient();

    globalContainer = {
      provider: "supabase",
      projects: new SupabaseProjectRepository(db),
      workflowRuns: new SupabaseWorkflowRunRepository(db),
      workflowTasks: new SupabaseWorkflowTaskRepository(db),
      attempts: new SupabaseAttemptRepository(db),
      checkpoints: new SupabaseWorkflowCheckpointRepository(db),
      artifacts: new SupabaseArtifactStore(db),
    };

    return globalContainer;
  }

  globalContainer = {
    provider: "memory",
    projects: new InMemoryProjectRepository(),
    workflowRuns: new InMemoryWorkflowRunRepository(),
    workflowTasks: new InMemoryWorkflowTaskRepository(),
    attempts: new InMemoryAttemptRepository(),
    checkpoints: new InMemoryWorkflowCheckpointRepository(),
    artifacts: new InMemoryArtifactStoreV2(),
  };

  return globalContainer;
}
