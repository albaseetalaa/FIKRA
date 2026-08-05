import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

// This is a static, source-text-only architecture test. It never imports
// or executes any production route module — it only reads route.ts files
// as text and inspects their TypeScript AST — so it stays safe to run
// with no persistence, Supabase, AI provider, or network access, and it
// sidesteps this project's zero-config vitest setup not resolving real
// "@/..." alias imports at runtime.

const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_FILE_DIR, "../../..");
const API_ROOT = resolve(REPO_ROOT, "src/app/api");

function toRepoRelative(absolutePath: string): string {
  return relative(REPO_ROOT, absolutePath).split(sep).join("/");
}

const EXCLUDED_DIR_NAMES = new Set(["node_modules", ".next", "out", "build"]);

function discoverRouteFiles(dir: string): string[] {
  const found: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      found.push(...discoverRouteFiles(join(dir, entry.name)));
      continue;
    }

    if (entry.isFile() && entry.name === "route.ts") {
      found.push(join(dir, entry.name));
    }
  }

  return found;
}

interface RouteFile {
  absolutePath: string;
  normalizedPath: string;
}

const routes: RouteFile[] = discoverRouteFiles(API_ROOT)
  .sort()
  .map((absolutePath) => ({
    absolutePath,
    normalizedPath: toRepoRelative(absolutePath),
  }));

interface ImportRecord {
  kind: "static" | "dynamic";
  specifier: string;
  namedImports: { importedName: string; localName: string }[];
  hasDefaultImport: boolean;
  hasNamespaceImport: boolean;
}

function collectImports(sourceFile: ts.SourceFile): ImportRecord[] {
  const records: ImportRecord[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const namedImports: { importedName: string; localName: string }[] = [];
      let hasDefaultImport = false;
      let hasNamespaceImport = false;

      const clause = node.importClause;
      if (clause) {
        if (clause.name) {
          hasDefaultImport = true;
        }

        if (clause.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            hasNamespaceImport = true;
          } else if (ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) {
              const importedName = (element.propertyName ?? element.name).text;
              const localName = element.name.text;
              namedImports.push({ importedName, localName });
            }
          }
        }
      }

      records.push({ kind: "static", specifier, namedImports, hasDefaultImport, hasNamespaceImport });
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const firstArgument = node.arguments[0];
      if (firstArgument !== undefined && ts.isStringLiteral(firstArgument)) {
        records.push({
          kind: "dynamic",
          specifier: firstArgument.text,
          namedImports: [],
          hasDefaultImport: false,
          hasNamespaceImport: false,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return records;
}

function parseRouteImports(route: RouteFile): ImportRecord[] {
  const sourceText = readFileSync(route.absolutePath, "utf8");
  const sourceFile = ts.createSourceFile(route.absolutePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return collectImports(sourceFile);
}

const routeImports: Map<string, ImportRecord[]> = new Map(
  routes.map((route) => [route.normalizedPath, parseRouteImports(route)]),
);

function resolveLocalPath(specifier: string, routeAbsolutePath: string): string | null {
  if (specifier.startsWith("@/")) {
    return `src/${specifier.slice(2)}`;
  }

  if (specifier.startsWith(".")) {
    const resolvedAbsolute = resolve(dirname(routeAbsolutePath), specifier);
    return toRepoRelative(resolvedAbsolute);
  }

  return null;
}

function isPathOrDescendant(candidate: string, base: string): boolean {
  return candidate === base || candidate.startsWith(`${base}/`);
}

// Explicit, deliberately-empty exception map. Keyed by normalized
// repository-relative route path; values are exact permitted module
// specifiers for that route. Adding an entry here requires a deliberate
// edit to this test file, so a future exception can never slip in
// silently.
const ALLOWED_ROUTE_IMPORT_EXCEPTIONS: Record<string, readonly string[]> = {};

const FORBIDDEN_BARE_SPECIFIERS = new Set(["@supabase/supabase-js"]);

const FORBIDDEN_LOCAL_BASES = [
  "src/lib/persistence",
  "src/lib/supabase/server",
  "src/lib/supabase/admin",
  "src/ai/providers",
  "src/ai/store",
];

function findForbiddenModuleViolations(route: RouteFile, imports: ImportRecord[]): string[] {
  const exceptions = ALLOWED_ROUTE_IMPORT_EXCEPTIONS[route.normalizedPath] ?? [];
  const violations: string[] = [];

  for (const record of imports) {
    if (exceptions.includes(record.specifier)) continue;

    const resolvedLocalPath = resolveLocalPath(record.specifier, route.absolutePath);
    const isForbiddenBare = FORBIDDEN_BARE_SPECIFIERS.has(record.specifier);
    const isForbiddenLocal =
      resolvedLocalPath !== null && FORBIDDEN_LOCAL_BASES.some((base) => isPathOrDescendant(resolvedLocalPath, base));

    if (isForbiddenBare || isForbiddenLocal) {
      const verb = record.kind === "static" ? "statically imports" : "dynamically imports";
      const resolvedSuffix = resolvedLocalPath ? ` resolving to "${resolvedLocalPath}"` : "";
      violations.push(`${route.normalizedPath} ${verb} forbidden module "${record.specifier}"${resolvedSuffix}`);
    }
  }

  return violations;
}

// Named-symbol check: limited protection against a future re-export
// bypass (e.g. a forbidden symbol re-exported through an unanticipated
// module path). Full transitive dependency-graph resolution is
// intentionally out of scope for this first implementation — no
// barrel/index re-export module exists anywhere in the persistence,
// Supabase, or AI-provider trees today, so direct specifier + named
// symbol checks are proportionate to the current architecture.
const FORBIDDEN_SYMBOLS = new Set([
  "createAdminClient",
  "getPersistenceContainer",
  "getSystemPersistenceContainer",
  "getRequestPersistenceContainer",
]);

function findForbiddenSymbolViolations(route: RouteFile, imports: ImportRecord[]): string[] {
  const violations: string[] = [];

  for (const record of imports) {
    for (const { importedName, localName } of record.namedImports) {
      if (FORBIDDEN_SYMBOLS.has(importedName) || FORBIDDEN_SYMBOLS.has(localName)) {
        violations.push(`${route.normalizedPath} imports forbidden symbol "${importedName}" from "${record.specifier}"`);
      }
    }
  }

  return violations;
}

const AUTH_MODULE_PATH = "src/lib/auth/requireAuthenticatedUser";
const AUTH_BASE_PATH = "src/lib/auth";
const REQUIRED_AUTH_NAMES = ["AuthenticationRequiredError", "requireAuthenticatedUser"].sort();

function findAuthBoundaryViolations(route: RouteFile, imports: ImportRecord[]): string[] {
  const violations: string[] = [];

  const authModuleImports = imports.filter(
    (record) => record.kind === "static" && resolveLocalPath(record.specifier, route.absolutePath) === AUTH_MODULE_PATH,
  );

  if (authModuleImports.length !== 1) {
    violations.push(
      `${route.normalizedPath} must import exactly one declaration from "${AUTH_MODULE_PATH}", found ${authModuleImports.length}`,
    );
  } else {
    const record = authModuleImports[0]!;

    if (record.hasDefaultImport) {
      violations.push(`${route.normalizedPath} must not default-import "${AUTH_MODULE_PATH}"`);
    }

    if (record.hasNamespaceImport) {
      violations.push(`${route.normalizedPath} must not namespace-import "${AUTH_MODULE_PATH}"`);
    }

    const importedNames = record.namedImports.map((entry) => entry.importedName).sort();
    const matchesExactly =
      importedNames.length === REQUIRED_AUTH_NAMES.length &&
      importedNames.every((name, index) => name === REQUIRED_AUTH_NAMES[index]);

    if (!matchesExactly) {
      violations.push(
        `${route.normalizedPath} must import exactly {${REQUIRED_AUTH_NAMES.join(", ")}} from "${AUTH_MODULE_PATH}", found {${importedNames.join(", ")}}`,
      );
    }
  }

  for (const record of imports) {
    const resolvedLocalPath = resolveLocalPath(record.specifier, route.absolutePath);
    if (resolvedLocalPath === null) continue;

    if (isPathOrDescendant(resolvedLocalPath, AUTH_BASE_PATH) && resolvedLocalPath !== AUTH_MODULE_PATH) {
      violations.push(
        `${route.normalizedPath} imports unapproved auth module "${record.specifier}" resolving to "${resolvedLocalPath}"`,
      );
    }
  }

  return violations;
}

describe("API route import boundary", () => {
  it("discovers production API routes", () => {
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      expect(route.normalizedPath.startsWith("src/app/api/")).toBe(true);
      expect(route.normalizedPath.endsWith("/route.ts")).toBe(true);
    }
  });

  for (const route of routes) {
    it(`${route.normalizedPath} imports no forbidden module`, () => {
      const imports = routeImports.get(route.normalizedPath) ?? [];
      const violations = findForbiddenModuleViolations(route, imports);
      expect(violations).toEqual([]);
    });
  }

  it("API routes import no forbidden persistence or admin symbols", () => {
    const violations = routes.flatMap((route) => findForbiddenSymbolViolations(route, routeImports.get(route.normalizedPath) ?? []));
    expect(violations).toEqual([]);
  });

  it("API routes use only the approved authentication boundary", () => {
    const violations = routes.flatMap((route) => findAuthBoundaryViolations(route, routeImports.get(route.normalizedPath) ?? []));
    expect(violations).toEqual([]);
  });
});
