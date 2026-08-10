import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useActionStateMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: useActionStateMock,
  };
});

vi.mock("@/lib/auth/actions", () => ({
  signUpAction: vi.fn(),
}));

import SignupForm from "./SignupForm";

const NEXT_PATH = "/create-project";
const IDLE_STATE = { status: "idle" as const, error: null };
const ERROR_STATE = { status: "error" as const, error: "Passwords do not match." };
const SUCCESS_STATE = {
  status: "success" as const,
  error: null,
  message: "Check your email to confirm your account before logging in.",
};

function render(
  state: typeof IDLE_STATE | typeof ERROR_STATE | typeof SUCCESS_STATE,
  isPending: boolean,
) {
  useActionStateMock.mockReturnValue([state, vi.fn(), isPending]);
  return renderToStaticMarkup(createElement(SignupForm, { nextPath: NEXT_PATH }));
}

function extractButton(markup: string): string {
  const match = markup.match(/<button[\s\S]*?<\/button>/);
  if (!match) throw new Error(`No <button> found in markup: ${markup}`);
  return match[0];
}

function extractStatusSpan(markup: string): string {
  const match = markup.match(/<span[^>]*role="status"[^>]*>[\s\S]*?<\/span>/);
  if (!match) throw new Error(`No role="status" span found in markup: ${markup}`);
  return match[0];
}

function classListOf(markup: string): string[] {
  const match = markup.match(/class="([^"]*)"/);
  if (!match) throw new Error(`No class attribute found in markup: ${markup}`);
  return match[1]!.split(/\s+/).filter(Boolean);
}

function innerTextOf(elementMarkup: string): string {
  return elementMarkup.replace(/^<[^>]*>/, "").replace(/<\/[^>]*>$/, "");
}

describe("SignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders exactly one native button", () => {
    const markup = render(IDLE_STATE, false);
    const buttonCount = (markup.match(/<button[\s>]/g) ?? []).length;
    expect(buttonCount).toBe(1);
  });

  it('the rendered shared Button has type="submit"', () => {
    const button = extractButton(render(IDLE_STATE, false));
    expect(button).toContain('type="submit"');
  });

  it("default primary semantic classes are present", () => {
    const classes = classListOf(extractButton(render(IDLE_STATE, false)));
    expect(classes).toContain("bg-action-primary-background");
    expect(classes).toContain("text-action-primary-foreground");
  });

  it("shared Button base geometry is present", () => {
    const classes = classListOf(extractButton(render(IDLE_STATE, false)));
    for (const cls of [
      "inline-flex",
      "items-center",
      "justify-center",
      "min-h-12",
      "px-6",
      "gap-2",
      "rounded-md",
      "text-sm",
      "font-semibold",
    ]) {
      expect(classes).toContain(cls);
    }
  });

  it('className="w-full" composes correctly', () => {
    const classes = classListOf(extractButton(render(IDLE_STATE, false)));
    expect(classes).toContain("w-full");
  });

  it("old rounded-full and py-3 geometry is absent", () => {
    const classes = classListOf(extractButton(render(IDLE_STATE, false)));
    expect(classes).not.toContain("rounded-full");
    expect(classes).not.toContain("py-3");
  });

  it("old brand/palette button classes are absent", () => {
    const classes = classListOf(extractButton(render(IDLE_STATE, false)));
    expect(classes).not.toContain("bg-brand-700");
    expect(classes).not.toContain("hover:bg-brand-800");
    expect(classes).not.toContain("bg-white/8");
    expect(classes).not.toContain("text-white");
  });

  it("no duplicate consumer-authored color/hover/active/focus/opacity/cursor classes are added beyond Button's own and w-full", () => {
    const idleClasses = new Set(classListOf(extractButton(render(IDLE_STATE, false))));
    const pendingClasses = new Set(classListOf(extractButton(render(IDLE_STATE, true))));
    for (const forbidden of ["bg-brand-700", "hover:bg-brand-800", "bg-white/8", "text-white"]) {
      expect(idleClasses.has(forbidden)).toBe(false);
      expect(pendingClasses.has(forbidden)).toBe(false);
    }
  });

  it("idle state has no native disabled attribute", () => {
    const button = extractButton(render(IDLE_STATE, false));
    expect(button).not.toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("idle state has no aria-disabled attribute", () => {
    const button = extractButton(render(IDLE_STATE, false));
    expect(button).not.toContain("aria-disabled");
  });

  it("idle state has no aria-busy attribute", () => {
    const button = extractButton(render(IDLE_STATE, false));
    expect(button).not.toContain("aria-busy");
  });

  it("pending state still has no native disabled attribute", () => {
    const button = extractButton(render(IDLE_STATE, true));
    expect(button).not.toMatch(/\sdisabled(=""|\s|>)/);
  });

  it('pending state has aria-disabled="true"', () => {
    const button = extractButton(render(IDLE_STATE, true));
    expect(button).toContain('aria-disabled="true"');
  });

  it('pending state has aria-busy="true"', () => {
    const button = extractButton(render(IDLE_STATE, true));
    expect(button).toContain('aria-busy="true"');
  });

  it("pending state has the shared inactive opacity", () => {
    const classes = classListOf(extractButton(render(IDLE_STATE, true)));
    expect(classes).toContain("opacity-[var(--action-disabled-opacity)]");
  });

  it("pending state has cursor-not-allowed", () => {
    const classes = classListOf(extractButton(render(IDLE_STATE, true)));
    expect(classes).toContain("cursor-not-allowed");
  });

  it("pending state omits Button-owned hover classes", () => {
    const classes = classListOf(extractButton(render(IDLE_STATE, true)));
    expect(classes).not.toContain("hover:bg-action-primary-hover");
  });

  it("pending state omits Button-owned active classes", () => {
    const classes = classListOf(extractButton(render(IDLE_STATE, true)));
    expect(classes).not.toContain("active:bg-action-primary-active");
  });

  it("idle visible label is exact", () => {
    const button = extractButton(render(IDLE_STATE, false));
    expect(innerTextOf(button)).toBe("Sign up");
  });

  it("pending visible label is exact", () => {
    const button = extractButton(render(IDLE_STATE, true));
    expect(innerTextOf(button)).toBe("Creating account...");
  });

  it('stable role="status" exists while idle', () => {
    const markup = render(IDLE_STATE, false);
    expect(() => extractStatusSpan(markup)).not.toThrow();
  });

  it("idle status region is empty", () => {
    const span = extractStatusSpan(render(IDLE_STATE, false));
    expect(innerTextOf(span)).toBe("");
  });

  it("the same status region contains the exact pending text while pending", () => {
    const span = extractStatusSpan(render(IDLE_STATE, true));
    expect(innerTextOf(span)).toBe("Creating account...");
  });

  it("the status region is screen-reader available through sr-only", () => {
    const span = extractStatusSpan(render(IDLE_STATE, false));
    expect(classListOf(span)).toContain("sr-only");
  });

  it("no aria-live, aria-atomic, role=alert, spinner, icon, animation, or invented pending copy is added to the loading status", () => {
    const span = extractStatusSpan(render(IDLE_STATE, true));
    expect(span).not.toContain("aria-live");
    expect(span).not.toContain("aria-atomic");
    expect(span).not.toContain('role="alert"');
    expect(span).not.toContain("<svg");
    expect(span).not.toContain("animate-");
    expect(innerTextOf(span)).toBe("Creating account...");
  });

  it("existing form inputs and validation attributes remain rendered", () => {
    const markup = render(IDLE_STATE, false);
    expect(markup).toContain('name="email"');
    expect(markup).toContain('type="email"');
    expect(markup).toContain('name="password"');
    expect(markup).toContain('name="confirmPassword"');
    expect(markup).toMatch(/<input[^>]*minLength="8"[^>]*name="password"/);
    expect(markup).toMatch(/<input[^>]*minLength="8"[^>]*name="confirmPassword"/);
    expect(markup).toMatch(/<input[^>]*required[^>]*name="email"/);
  });

  it('existing error state remains role="alert"', () => {
    const markup = render(ERROR_STATE, false);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(ERROR_STATE.error);
  });

  it("existing counterpart navigation link and nextPath remain correct", () => {
    const markup = render(IDLE_STATE, false);
    const expectedHref = `/login?next=${encodeURIComponent(NEXT_PATH)}`;
    expect(markup).toContain(`href="${expectedHref}"`);
  });

  it("the success branch remains unchanged in meaning and keeps its existing visible success role=\"status\"", () => {
    const markup = render(SUCCESS_STATE, false);
    expect(markup).toContain('role="status"');
    expect(markup).toContain(SUCCESS_STATE.message);
    expect(markup).toContain('href="/login"');
    expect(markup).toContain("Check your inbox");
  });

  it("the success branch does not render the form's loading Button or loading status region", () => {
    const markup = render(SUCCESS_STATE, false);
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("sr-only");
  });
});
