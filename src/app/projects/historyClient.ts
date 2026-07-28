import type { ProjectHistoryItem } from "../../lib/persistence/types";
import { parseProjectHistoryResponse } from "../../lib/project-workflow/historyContract";

export type ProjectHistoryViewState = {
  items: ProjectHistoryItem[];
  error: string | null;
  loading: boolean;
};

export function getLoadedState(items: ProjectHistoryItem[]): ProjectHistoryViewState {
  return {
    items,
    error: null,
    loading: false,
  };
}

export async function loadProjectHistoryItems(fetchImpl: typeof fetch = fetch): Promise<ProjectHistoryItem[]> {
  const res = await fetchImpl("/api/projects/history", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load projects.");
  const payload = await res.json();
  return parseProjectHistoryResponse(payload).items;
}
