import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const forbiddenPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "Competitor A", pattern: /\bCompetitor A\b/i },
  { label: "Competitor B", pattern: /\bCompetitor B\b/i },
  { label: "200M annual transactions", pattern: /\b200M annual transactions\b/i },
  { label: "Subscription adoption", pattern: /\bSubscription adoption\b/i },
  { label: "On-demand services growth", pattern: /\bOn-demand services growth\b/i },
  { label: "Demo Project", pattern: /\bDemo Project\b/i },
  { label: "Stale 2024 ISO date", pattern: /\b2024-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])\b/ },
];

const ignoredPathPatterns = [
  /\.test\./i,
  /testing\//i,
  /__tests__\//i,
  /README\.md$/i,
  /docs\//i,
  /node_modules\//i,
  /\.next\//i,
  /\.tmp\//i,
];

function listSourceFiles(root: string): string[] {
  const output: string[] = [];
  const walk = (dir: string) => {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const rel = relative(root, full).replace(/\\/g, "/");
      if (ignoredPathPatterns.some((pattern) => pattern.test(rel))) continue;
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx)$/.test(full)) continue;
      output.push(full);
    }
  };
  walk(join(root, "src"));
  return output;
}

describe("production placeholder scan", () => {
  it("does not include banned demo placeholders in production source", () => {
    const root = process.cwd();
    const files = listSourceFiles(root);
    const hits: Array<{ file: string; snippet: string }> = [];

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const { label, pattern } of forbiddenPatterns) {
        if (pattern.test(text)) {
          hits.push({ file: relative(root, file).replace(/\\/g, "/"), snippet: label });
        }
      }
    }

    expect(hits).toEqual([]);
  });
});
