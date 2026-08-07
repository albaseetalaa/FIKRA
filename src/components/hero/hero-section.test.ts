import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The "Start Your Project" CTA does not need its own client-side auth
// check: it always links to /create-project, and that route redirects
// unauthenticated visitors to /login?next=/create-project on the server
// (see src/app/create-project/page.test.ts). This keeps a single source
// of truth for the auth decision instead of duplicating it in the
// landing page, per the requirement to not rely only on client checks.
describe("hero section 'Start Your Project' CTA", () => {
  it("links directly to the server-protected /create-project route", () => {
    const modulePath = fileURLToPath(new URL("./hero-section.tsx", import.meta.url));
    const source = readFileSync(modulePath, "utf8");

    const startProjectMatch = source.match(
      /<HeroButton\s+href="([^"]+)"\s+variant="primary">\s*Start Your Project/,
    );

    expect(startProjectMatch).not.toBeNull();
    expect(startProjectMatch?.[1]).toBe("/create-project");
  });
});
