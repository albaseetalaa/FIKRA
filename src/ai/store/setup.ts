import { getPersistenceContainer } from "../../lib/persistence/setup";
import type { PersistenceContainer } from "../../lib/persistence/interfaces";

type ArtifactStore = PersistenceContainer["artifacts"];

function getArtifactStore(): ArtifactStore {
  return getPersistenceContainer().artifacts;
}

/**
 * Lazy singleton facade over the configured artifact store.
 *
 * Importing this module must not initialize production persistence during
 * Next.js build-time route analysis. The real store is resolved only when
 * one of its properties or methods is used at runtime.
 */
export const globalArtifactStore = new Proxy({} as ArtifactStore, {
  get(_target, property) {
    const store = getArtifactStore();
    const value = Reflect.get(store, property, store);

    return typeof value === "function" ? value.bind(store) : value;
  },
});

export default globalArtifactStore;
