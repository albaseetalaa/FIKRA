import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: vi.fn(),
  };
});

import GlobalError from "./error";

const ERROR = Object.assign(new Error("boom"), { digest: "abc123" });

function render(reset = vi.fn()) {
  return renderToStaticMarkup(
    createElement(GlobalError, { error: ERROR, reset }),
  );
}

function extractButtons(markup: string): string[] {
  return markup.match(/<button[\s\S]*?<\/button>/g) ?? [];
}

function classListOf(elementMarkup: string): string[] {
  const match = elementMarkup.match(/class="([^"]*)"/);
  if (!match)
    throw new Error(`No class attribute found in markup: ${elementMarkup}`);
  return match[1]!.split(/\s+/).filter(Boolean);
}

function innerTextOf(elementMarkup: string): string {
  return elementMarkup.replace(/^<[^>]*>/, "").replace(/<\/[^>]*>$/, "");
}

describe("GlobalError", () => {
  it("renders exactly one native button", () => {
    const markup = render();
    expect(extractButtons(markup).length).toBe(1);
  });

  it('the rendered shared Button has type="button"', () => {
    const [button] = extractButtons(render());
    expect(button).toContain('type="button"');
  });

  it("uses the shared primary semantic classes", () => {
    const [button] = extractButtons(render());
    const classes = classListOf(button!);
    expect(classes).toContain("bg-action-primary-background");
    expect(classes).toContain("text-action-primary-foreground");
  });

  it("uses the shared Button geometry", () => {
    const [button] = extractButtons(render());
    const classes = classListOf(button!);
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

  it("old button palette and geometry classes are absent", () => {
    const [button] = extractButtons(render());
    const classes = classListOf(button!);
    expect(classes).not.toContain("bg-brand-600");
    expect(classes).not.toContain("hover:bg-brand-700");
    expect(classes).not.toContain("px-4");
    expect(classes).not.toContain("py-2");
    expect(classes).not.toContain("font-medium");
    expect(classes).not.toContain("text-white");
  });

  it('the visible label is exactly "Try again"', () => {
    const [button] = extractButtons(render());
    expect(innerTextOf(button!)).toBe("Try again");
  });

  it('the heading "Something went wrong" remains unchanged', () => {
    const markup = render();
    expect(markup).toContain("Something went wrong");
  });

  it("the existing description remains unchanged", () => {
    const markup = render();
    expect(markup).toContain(
      "An unexpected error occurred. Try again, and if the problem persists, contact support.",
    );
  });

  it("reset is wired to the button's onClick", () => {
    const resetMock = vi.fn();
    const element = GlobalError({
      error: ERROR,
      reset: resetMock,
    }) as ReactElement<{
      children: ReactElement[];
    }>;
    const [, , buttonElement] = element.props.children;
    expect(
      (buttonElement as ReactElement<{ onClick: () => void }>).props.onClick,
    ).toBe(resetMock);
  });

  it("the outer error-page layout remains unchanged", () => {
    const markup = render();
    expect(markup).toContain(
      'class="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"',
    );
    expect(markup).toContain(
      'class="text-2xl font-semibold text-neutral-900 sm:text-3xl"',
    );
    expect(markup).toContain('class="text-base text-neutral-600"');
  });
});
