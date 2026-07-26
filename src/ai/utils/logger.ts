export function logInfo(message: string, meta?: Record<string, unknown>) {
  // Lightweight logger — can be replaced with structured logger in production
  // Avoid heavy dependencies at this stage.
  // Keep synchronous and side-effect free for tests.
  console.warn(`[ai] ${message}`, meta ?? {});
}

export function logError(message: string, meta?: Record<string, unknown>) {
  console.error(`[ai][error] ${message}`, meta ?? {});
}
