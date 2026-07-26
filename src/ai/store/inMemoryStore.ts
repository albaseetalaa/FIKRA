import { ArtifactStore, ArtifactRecord } from "./artifactStore";

export class InMemoryArtifactStore implements ArtifactStore {
  private items: Map<string, ArtifactRecord> = new Map();

  async save(rec: Omit<ArtifactRecord, "artifactId" | "createdAt" | "updatedAt">) {
    const id = `art_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const record: ArtifactRecord = { ...rec, artifactId: id, createdAt: now, updatedAt: now };
    this.items.set(id, record);
    return record;
  }

  async get(artifactId: string) {
    return this.items.get(artifactId) ?? null;
  }

  async list(projectId?: string) {
    const all = Array.from(this.items.values());
    if (!projectId) return all;
    return all.filter((a) => a.projectId === projectId);
  }

  async delete(artifactId: string) {
    return this.items.delete(artifactId);
  }

  async exists(artifactId: string) {
    return this.items.has(artifactId);
  }

  clear() {
    this.items.clear();
  }
}

export default InMemoryArtifactStore;
