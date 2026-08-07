import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getDraftStorageKey, loadDraft, saveDraft } from "./draftStorage";
import { initialWizardData, type WizardData } from "./types";

class FakeStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("draft storage", () => {
  it("scopes the storage key per authenticated user", () => {
    expect(getDraftStorageKey("user_a")).not.toBe(getDraftStorageKey("user_b"));
    expect(getDraftStorageKey("user_a")).toContain("user_a");
  });

  it("round-trips a saved draft for the same user", () => {
    const storage = new FakeStorage();
    const data: WizardData = { ...initialWizardData, idea: "A healthy breakfast restaurant idea." };

    expect(saveDraft("user_a", data, storage)).toBe(true);
    expect(loadDraft("user_a", initialWizardData, storage)).toEqual(data);
  });

  it("does not leak one user's draft to another user sharing a device", () => {
    const storage = new FakeStorage();
    const data: WizardData = { ...initialWizardData, idea: "User A's private idea." };

    saveDraft("user_a", data, storage);

    expect(loadDraft("user_b", initialWizardData, storage)).toEqual(initialWizardData);
  });

  it("falls back gracefully when storage is unavailable or throws", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("storage disabled");
      },
      setItem: () => {
        throw new Error("storage disabled");
      },
    } as unknown as Storage;

    expect(loadDraft("user_a", initialWizardData, throwingStorage)).toEqual(initialWizardData);
    expect(saveDraft("user_a", initialWizardData, throwingStorage)).toBe(false);
  });

  it("never performs a network call — the draft module contains no fetch or API references", () => {
    const modulePath = fileURLToPath(new URL("./draftStorage.ts", import.meta.url));
    const source = readFileSync(modulePath, "utf8");

    expect(source).not.toMatch(/fetch\(/);
    expect(source).not.toMatch(/\/api\//);
  });
});
