import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import WizardNavigation from "./WizardNavigation";

type Props = React.ComponentProps<typeof WizardNavigation>;

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    step: 1,
    total: 3,
    onBack: vi.fn(),
    onContinue: vi.fn(),
    canContinue: true,
    onSaveDraft: vi.fn(),
    onSubmit: vi.fn(),
    submitting: false,
    ...overrides,
  };
}

function render(overrides: Partial<Props> = {}) {
  return renderToStaticMarkup(createElement(WizardNavigation, baseProps(overrides)));
}

function extractButtons(markup: string): string[] {
  return markup.match(/<button[\s\S]*?<\/button>/g) ?? [];
}

function extractStatusSpan(markup: string): string {
  const match = markup.match(/<span[^>]*role="status"[^>]*>[\s\S]*?<\/span>/);
  if (!match) throw new Error(`No role="status" span found in markup: ${markup}`);
  return match[0];
}

function classListOf(elementMarkup: string): string[] {
  const match = elementMarkup.match(/class="([^"]*)"/);
  if (!match) throw new Error(`No class attribute found in markup: ${elementMarkup}`);
  return match[1]!.split(/\s+/).filter(Boolean);
}

function innerTextOf(elementMarkup: string): string {
  return elementMarkup.replace(/^<[^>]*>/, "").replace(/<\/[^>]*>$/, "");
}

describe("WizardNavigation", () => {
  it("renders exactly three native buttons before the final step", () => {
    const markup = render({ step: 1, total: 3 });
    expect(extractButtons(markup).length).toBe(3);
  });

  it("renders exactly three native buttons on the final step", () => {
    const markup = render({ step: 3, total: 3 });
    expect(extractButtons(markup).length).toBe(3);
  });

  it('every button has type="button"', () => {
    for (const markup of [render({ step: 1, total: 3 }), render({ step: 3, total: 3 })]) {
      for (const button of extractButtons(markup)) {
        expect(button).toContain('type="button"');
      }
    }
  });

  it("Back uses ghost semantic classes", () => {
    const [back] = extractButtons(render());
    const classes = classListOf(back!);
    expect(classes).toContain("bg-action-ghost-background");
    expect(classes).toContain("text-action-ghost-foreground");
  });

  it("Save Draft uses secondary semantic classes and border", () => {
    const [, saveDraft] = extractButtons(render());
    const classes = classListOf(saveDraft!);
    expect(classes).toContain("border");
    expect(classes).toContain("border-border-strong");
    expect(classes).toContain("bg-action-secondary-background");
    expect(classes).toContain("text-action-secondary-foreground");
  });

  it("Continue uses primary semantic classes", () => {
    const [, , cont] = extractButtons(render({ step: 1, total: 3 }));
    const classes = classListOf(cont!);
    expect(classes).toContain("bg-action-primary-background");
    expect(classes).toContain("text-action-primary-foreground");
  });

  it("Create uses primary semantic classes", () => {
    const [, , create] = extractButtons(render({ step: 3, total: 3 }));
    const classes = classListOf(create!);
    expect(classes).toContain("bg-action-primary-background");
    expect(classes).toContain("text-action-primary-foreground");
  });

  it("Continue is enabled when canContinue is true", () => {
    const [, , cont] = extractButtons(render({ step: 1, total: 3, canContinue: true }));
    expect(cont).not.toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("Continue is native-disabled when canContinue is false", () => {
    const [, , cont] = extractButtons(render({ step: 1, total: 3, canContinue: false }));
    expect(cont).toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("Continue stays enabled while submitting, governed only by canContinue", () => {
    const [, , cont] = extractButtons(render({ step: 1, total: 3, canContinue: true, submitting: true }));
    expect(cont).not.toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("Back is native-disabled while submitting", () => {
    const [back] = extractButtons(render({ submitting: true }));
    expect(back).toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("Save Draft is native-disabled while submitting", () => {
    const [, saveDraft] = extractButtons(render({ submitting: true }));
    expect(saveDraft).toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("Back is not disabled when not submitting", () => {
    const [back] = extractButtons(render({ submitting: false }));
    expect(back).not.toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("Save Draft is not disabled when not submitting", () => {
    const [, saveDraft] = extractButtons(render({ submitting: false }));
    expect(saveDraft).not.toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("final idle state shows the exact Create label", () => {
    const [, , create] = extractButtons(render({ step: 3, total: 3, submitting: false }));
    expect(innerTextOf(create!)).toBe("Create My Project");
  });

  it("final idle Create button has no native disabled attribute", () => {
    const [, , create] = extractButtons(render({ step: 3, total: 3, submitting: false }));
    expect(create).not.toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("final idle Create button has no aria-disabled or aria-busy", () => {
    const [, , create] = extractButtons(render({ step: 3, total: 3, submitting: false }));
    expect(create).not.toContain("aria-disabled");
    expect(create).not.toContain("aria-busy");
  });

  it("final loading state shows the exact pending label", () => {
    const [, , create] = extractButtons(render({ step: 3, total: 3, submitting: true }));
    expect(innerTextOf(create!)).toBe("Creating...");
  });

  it('final loading Create button has aria-disabled="true"', () => {
    const [, , create] = extractButtons(render({ step: 3, total: 3, submitting: true }));
    expect(create).toContain('aria-disabled="true"');
  });

  it('final loading Create button has aria-busy="true"', () => {
    const [, , create] = extractButtons(render({ step: 3, total: 3, submitting: true }));
    expect(create).toContain('aria-busy="true"');
  });

  it("final loading Create button has no native disabled attribute", () => {
    const [, , create] = extractButtons(render({ step: 3, total: 3, submitting: true }));
    expect(create).not.toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("final loading Create button has the shared inactive opacity and cursor", () => {
    const [, , create] = extractButtons(render({ step: 3, total: 3, submitting: true }));
    const classes = classListOf(create!);
    expect(classes).toContain("opacity-[var(--action-disabled-opacity)]");
    expect(classes).toContain("cursor-not-allowed");
  });

  it("final loading Create button omits Button-owned hover and active classes", () => {
    const [, , create] = extractButtons(render({ step: 3, total: 3, submitting: true }));
    const classes = classListOf(create!);
    expect(classes).not.toContain("hover:bg-action-primary-hover");
    expect(classes).not.toContain("active:bg-action-primary-active");
  });

  it('a stable role="status" region exists in the final idle state', () => {
    const markup = render({ step: 3, total: 3, submitting: false });
    expect(() => extractStatusSpan(markup)).not.toThrow();
  });

  it("final idle status region is empty", () => {
    const span = extractStatusSpan(render({ step: 3, total: 3, submitting: false }));
    expect(innerTextOf(span)).toBe("");
  });

  it('the same role="status" region exists in the final loading state', () => {
    const markup = render({ step: 3, total: 3, submitting: true });
    expect(() => extractStatusSpan(markup)).not.toThrow();
  });

  it("final loading status region has the exact pending text", () => {
    const span = extractStatusSpan(render({ step: 3, total: 3, submitting: true }));
    expect(innerTextOf(span)).toBe("Creating...");
  });

  it("the status region is screen-reader available through sr-only", () => {
    const span = extractStatusSpan(render({ step: 3, total: 3, submitting: false }));
    expect(classListOf(span)).toContain("sr-only");
  });

  it("no aria-live, aria-atomic, role=alert, spinner, icon, or animation is added to the loading status", () => {
    const span = extractStatusSpan(render({ step: 3, total: 3, submitting: true }));
    expect(span).not.toContain("aria-live");
    expect(span).not.toContain("aria-atomic");
    expect(span).not.toContain('role="alert"');
    expect(span).not.toContain("<svg");
    expect(span).not.toContain("animate-");
  });

  it("old rounded-full, palette, and padding classes are absent from every button", () => {
    for (const markup of [render({ step: 1, total: 3 }), render({ step: 3, total: 3, submitting: true })]) {
      for (const button of extractButtons(markup)) {
        const classes = classListOf(button);
        expect(classes).not.toContain("rounded-full");
        expect(classes).not.toContain("bg-brand-700");
        expect(classes).not.toContain("hover:bg-brand-800");
        expect(classes).not.toContain("bg-white/8");
        expect(classes).not.toContain("text-white");
        expect(classes).not.toContain("py-2");
        expect(classes).not.toContain("py-3");
      }
    }
  });

  it("no spinner, animation, or invented copy is rendered anywhere", () => {
    const markup = render({ step: 3, total: 3, submitting: true });
    expect(markup).not.toContain("<svg");
    expect(markup).not.toContain("animate-");
  });

  it("outer navigation layout classes remain present", () => {
    const markup = render();
    expect(markup).toContain("mt-6 flex items-center justify-between gap-4");
    expect(markup).toContain("flex items-center gap-3");
  });

  it("only one primary Button is visible at a time", () => {
    for (const markup of [render({ step: 1, total: 3 }), render({ step: 3, total: 3 })]) {
      const primaryCount = extractButtons(markup).filter((button) =>
        classListOf(button).includes("bg-action-primary-background"),
      ).length;
      expect(primaryCount).toBe(1);
    }
  });
});
