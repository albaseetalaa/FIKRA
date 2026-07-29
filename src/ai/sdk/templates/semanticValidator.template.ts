export function semanticValidatorTemplate(raw: unknown): string[] {
  const record = raw as Record<string, unknown>;
  const issues: string[] = [];

  if (typeof record !== "object" || record === null) {
    issues.push("Output must be an object.");
    return issues;
  }

  // Add domain rules here.
  // Example: if (record.someField !== "expected") issues.push("someField must be expected.");

  return issues;
}
