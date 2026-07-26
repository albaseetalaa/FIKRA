import { getPersistenceContainer } from "../../lib/persistence/setup";

export const globalArtifactStore = getPersistenceContainer().artifacts;

export default globalArtifactStore;
