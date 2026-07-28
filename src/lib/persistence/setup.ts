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
  if (process.env.NODE_ENV === "test") return "memory";
  const configured = process.env.AI_PERSISTENCE_PROVIDER;
  if (configured === "supabase") return "supabase";
  return "memory";
}

function canUseSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function resetPersistenceContainerForTests() {
  globalContainer = null;
}

export function getPersistenceContainer(): PersistenceContainer {
  if (globalContainer) return globalContainer;

  const provider = resolveProvider();

  if (provider === "supabase" && canUseSupabase()) {
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
