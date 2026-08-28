import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAgentPrompt } from "./agentPromptBuilder";
import { createProjectContextFixture, getVerticalTemplate } from "../context";

// Regression coverage for the audit finding that businessStage was listed as
// an "authoritative" ProjectContext field the model must match exactly, but
// its actual value was never shown anywhere in the live prompt text — the
// match only "worked" because the provider JSON schema forces a single-value
// enum server-side. agentPromptBuilder.ts's common context block now
// includes an explicit `Business stage: ${projectContext.businessStage}`
// line using the canonical normalized value, with no inference/transform.

describe("buildAgentPrompt common context — business stage", () => {
  it("contains the literal current businessStage value", () => {
    const context = createProjectContextFixture({ businessStage: "planning" });
    const prompt = buildAgentPrompt({ agentId: "business_strategist", projectContext: context });

    expect(prompt).toContain("Business stage: planning");
  });

  it("changes when ProjectContext.businessStage changes, using the canonical value exactly", () => {
    const ideaContext = createProjectContextFixture({ businessStage: "idea" });
    const expandingContext = createProjectContextFixture({ businessStage: "expanding" });

    const ideaPrompt = buildAgentPrompt({ agentId: "business_strategist", projectContext: ideaContext });
    const expandingPrompt = buildAgentPrompt({ agentId: "business_strategist", projectContext: expandingContext });

    expect(ideaPrompt).toContain("Business stage: idea");
    expect(ideaPrompt).not.toContain("Business stage: expanding");
    expect(expandingPrompt).toContain("Business stage: expanding");
    expect(expandingPrompt).not.toContain("Business stage: idea");
  });

  it("applies to every agent that shares the common context block, not only business_strategist", () => {
    const context = createProjectContextFixture({ businessStage: "rebranding" });
    for (const agentId of ["business_strategist", "market_research", "financial_analyst"] as const) {
      const prompt = buildAgentPrompt({ agentId, projectContext: context });
      expect(prompt).toContain("Business stage: rebranding");
    }
  });

  it("does not regress unrelated common context lines", () => {
    const context = createProjectContextFixture({
      businessName: "Eggreen",
      country: "Jordan",
      currency: "JOD",
      businessStage: "planning",
    });
    const prompt = buildAgentPrompt({ agentId: "business_strategist", projectContext: context });

    expect(prompt).toContain("Business name: Eggreen");
    expect(prompt).toContain("Country: Jordan");
    expect(prompt).toContain("Currency: JOD");
    expect(prompt).toContain(`Business vertical: ${context.businessVertical}`);
    expect(prompt).toContain(`Primary revenue model: ${context.primaryRevenueModel}`);
  });
});

// Regression coverage for the audit finding that verticalTemplateVersion had
// no canonical source exposed to the model at all — serializeTemplate()
// omitted VerticalTemplate.version even though it already existed on the
// registry. The prompt's vertical template block now includes it (the
// authoritative enforcement of the persisted value is separate — see
// lifecycle.ts's withSystemOwnedProvenance and
// providerProvenance.test.ts — this only proves the prompt text itself).
describe("buildAgentPrompt — vertical template version", () => {
  it("includes the canonical VerticalTemplate.version for the project's vertical", () => {
    const context = createProjectContextFixture({ businessVertical: "restaurant_food_service" });
    const expectedVersion = getVerticalTemplate(context.businessVertical).version;

    const prompt = buildAgentPrompt({ agentId: "business_strategist", projectContext: context });

    expect(prompt).toContain(`"version": "${expectedVersion}"`);
  });

  it("reflects a different vertical's own registry version", () => {
    const context = createProjectContextFixture({ businessVertical: "saas_software" });
    const expectedVersion = getVerticalTemplate(context.businessVertical).version;

    const prompt = buildAgentPrompt({ agentId: "business_strategist", projectContext: context });

    expect(prompt).toContain(`"version": "${expectedVersion}"`);
  });
});

// Regression coverage for the audit finding that src/ai/prompts/prompts.ts
// was dead code — a separate, stale business_strategist prompt template
// never imported by the real execution path, but still re-exported from
// src/ai/index.ts as if it were live. Confirmed dead via full-repository
// search (no consumers of promptTemplates/renderPrompt beyond the file
// itself and the index.ts barrel) before removal. These guard against it
// silently reappearing.
describe("legacy prompt surface stays removed", () => {
  const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
  const AI_ROOT = resolve(TEST_FILE_DIR, "..");

  it("src/ai/prompts/prompts.ts does not exist", () => {
    expect(existsSync(resolve(AI_ROOT, "prompts/prompts.ts"))).toBe(false);
  });

  it("src/ai/index.ts does not re-export the legacy prompt template surface", () => {
    const indexSource = readFileSync(resolve(AI_ROOT, "index.ts"), "utf8");
    expect(indexSource).not.toContain("prompts/prompts");
  });
});
