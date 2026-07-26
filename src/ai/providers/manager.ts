import type AIProvider from "./interface";

export class ProviderManager {
  private providers: Map<string, AIProvider> = new Map();

  register(provider: AIProvider) {
    this.providers.set(provider.id, provider);
  }

  get(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  clear() {
    this.providers.clear();
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const globalProviderManager = new ProviderManager();

export default ProviderManager;
