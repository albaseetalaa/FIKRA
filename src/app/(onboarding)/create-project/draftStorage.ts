import type { WizardData } from "./types";

/**
 * The onboarding draft is a browser-local convenience only — it is never
 * sent to the server and never used to create a project. Scoping the key
 * per user keeps one device's drafts from leaking across accounts that
 * share it.
 */
export function getDraftStorageKey(userId: string): string {
  return `fikra:create-project:draft:v1:${userId}`;
}

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  return typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : null;
}

export function loadDraft(userId: string, fallback: WizardData, storage?: Storage): WizardData {
  try {
    const target = resolveStorage(storage);
    if (!target) return fallback;

    const raw = target.getItem(getDraftStorageKey(userId));
    return raw ? (JSON.parse(raw) as WizardData) : fallback;
  } catch {
    return fallback;
  }
}

export function saveDraft(userId: string, data: WizardData, storage?: Storage): boolean {
  try {
    const target = resolveStorage(storage);
    if (!target) return false;

    target.setItem(getDraftStorageKey(userId), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
