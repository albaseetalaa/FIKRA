import type { ProjectHistoryItem } from "../persistence/types";

export interface ProjectHistoryResponse {
  items: ProjectHistoryItem[];
}

export function parseProjectHistoryResponse(payload: unknown): ProjectHistoryResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid project history response.");
  }

  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    throw new Error("Project history response is missing items.");
  }

  return {
    items: items as ProjectHistoryItem[],
  };
}
