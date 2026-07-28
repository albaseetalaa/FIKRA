export interface InvokeOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  outputModel?: string;
  agentId?: string;
  timeoutMs?: number;
  stream?: boolean;
  [key: string]: unknown;
}

export interface ProviderHealth {
  ok: boolean;
  message?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  invoke(prompt: string, options?: InvokeOptions): Promise<unknown>;
  stream?(prompt: string, options?: InvokeOptions): AsyncIterable<string>;
  health(): Promise<ProviderHealth>;
  models(): Promise<string[]>;
  validateConfiguration(): Promise<boolean>;
}

export default AIProvider;
