import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "./nextPath";

describe("sanitizeNextPath", () => {
  it("accepts a plain relative path", () => {
    expect(sanitizeNextPath("/create-project", "/")).toBe("/create-project");
  });

  it("accepts a relative path with a query string", () => {
    expect(sanitizeNextPath("/projects?tab=history", "/")).toBe("/projects?tab=history");
  });

  it("falls back for missing input", () => {
    expect(sanitizeNextPath(undefined, "/fallback")).toBe("/fallback");
    expect(sanitizeNextPath(null, "/fallback")).toBe("/fallback");
    expect(sanitizeNextPath("", "/fallback")).toBe("/fallback");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeNextPath("//evil.com", "/fallback")).toBe("/fallback");
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeNextPath("https://evil.com/create-project", "/fallback")).toBe("/fallback");
    expect(sanitizeNextPath("javascript:alert(1)", "/fallback")).toBe("/fallback");
  });

  it("rejects backslash-based open-redirect payloads", () => {
    expect(sanitizeNextPath("/\\evil.com", "/fallback")).toBe("/fallback");
  });

  it("rejects whitespace and paths that don't start with a single slash", () => {
    expect(sanitizeNextPath(" /create-project", "/fallback")).toBe("/fallback");
    expect(sanitizeNextPath("create-project", "/fallback")).toBe("/fallback");
  });

  it("uses the first value when given an array (duplicate query params)", () => {
    expect(sanitizeNextPath(["/create-project", "//evil.com"], "/fallback")).toBe("/create-project");
  });
});
