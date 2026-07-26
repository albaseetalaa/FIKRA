export interface ArtifactMeta {
  artifactId: string;
  projectId: string;
  workflowRunId?: string;
  taskId?: string;
  agentId: string;
  pipelineId?: string;
  outputType: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion?: number;
  artifactVersion?: number;
  version: number;
  validationStatus: "valid" | "invalid";
}

export interface ArtifactRecord extends ArtifactMeta {
  content: unknown;
}

export interface ArtifactStore {
  save(rec: Omit<ArtifactRecord, "artifactId" | "createdAt" | "updatedAt">): Promise<ArtifactRecord>;
  get(artifactId: string): Promise<ArtifactRecord | null>;
  list(projectId?: string): Promise<ArtifactRecord[]>;
  delete(artifactId: string): Promise<boolean>;
  exists(artifactId: string): Promise<boolean>;
}

export default ArtifactStore;
