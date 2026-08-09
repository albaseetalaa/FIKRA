import { createElement, type MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Button, type ButtonProps, type ButtonVariant } from "./button";

function render(props: ButtonProps = {}) {
  return renderToStaticMarkup(createElement(Button, props));
}

function classListOf(markup: string): string[] {
  const match = markup.match(/class="([^"]*)"/);
  if (!match) throw new Error(`No class attribute found in markup: ${markup}`);
  return match[1]!.split(/\s+/).filter(Boolean);
}

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "destructive"];

describe("Button", () => {
  it("renders a native button", () => {
    const markup = render({ children: "Go" });
    expect(markup).toMatch(/^<button[\s>]/);
  });

  it("defaults variant to primary", () => {
    const classes = classListOf(render({ children: "Go" }));
    expect(classes).toContain("bg-action-primary-background");
    expect(classes).toContain("text-action-primary-foreground");
  });

  it("defaults type to button", () => {
    const markup = render({ children: "Go" });
    expect(markup).toContain('type="button"');
  });

  it("preserves an explicit submit type", () => {
    const markup = render({ type: "submit", children: "Go" });
    expect(markup).toContain('type="submit"');
  });

  it("preserves an explicit reset type", () => {
    const markup = render({ type: "reset", children: "Go" });
    expect(markup).toContain('type="reset"');
  });

  it("forwards ordinary native attributes", () => {
    const markup = render({ id: "save-button", "data-testid": "foo", children: "Go" } as ButtonProps);
    expect(markup).toContain('id="save-button"');
    expect(markup).toContain('data-testid="foo"');
  });

  it("preserves caller aria-disabled and aria-busy when not loading", () => {
    const markup = render({
      "aria-disabled": true,
      "aria-busy": true,
      children: "Go",
    } as ButtonProps);
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('aria-busy="true"');
  });

  it("composes caller className", () => {
    const classes = classListOf(render({ className: "custom-marker", children: "Go" }));
    expect(classes).toContain("custom-marker");
    expect(classes).toContain("bg-action-primary-background");
  });

  it("preserves className=\"w-full\"", () => {
    const classes = classListOf(render({ className: "w-full", children: "Go" }));
    expect(classes).toContain("w-full");
  });

  it("maps all four variants correctly", () => {
    const expected: Record<ButtonVariant, string[]> = {
      primary: ["bg-action-primary-background", "text-action-primary-foreground"],
      secondary: [
        "border",
        "border-border-strong",
        "bg-action-secondary-background",
        "text-action-secondary-foreground",
      ],
      ghost: ["bg-action-ghost-background", "text-action-ghost-foreground"],
      destructive: ["bg-action-destructive-background", "text-action-destructive-foreground"],
    };

    for (const variant of VARIANTS) {
      const classes = classListOf(render({ variant, children: "Go" }));
      for (const expectedClass of expected[variant]) {
        expect(classes, `variant ${variant} should include ${expectedClass}`).toContain(expectedClass);
      }
    }
  });

  it("includes the exact base geometry", () => {
    const classes = classListOf(render({ children: "Go" }));
    for (const expectedClass of [
      "inline-flex",
      "items-center",
      "justify-center",
      "min-h-12",
      "px-6",
      "gap-2",
      "rounded-md",
      "text-sm",
      "font-semibold",
      "outline-none",
    ]) {
      expect(classes).toContain(expectedClass);
    }
  });

  it("includes the shared focus-visible custom-property treatment", () => {
    const classes = classListOf(render({ children: "Go" }));
    expect(classes).toContain("focus-visible:outline");
    expect(classes).toContain("focus-visible:outline-[length:var(--focus-ring-width)]");
    expect(classes).toContain("focus-visible:outline-offset-[var(--focus-ring-offset)]");
    expect(classes).toContain("focus-visible:outline-[color:var(--color-border-focus)]");
  });

  it("secondary retains border-border-strong", () => {
    const classes = classListOf(render({ variant: "secondary", children: "Go" }));
    expect(classes).toContain("border");
    expect(classes).toContain("border-border-strong");
  });

  it("ghost has an explicit transparent semantic background and no border", () => {
    const classes = classListOf(render({ variant: "ghost", children: "Go" }));
    expect(classes).toContain("bg-action-ghost-background");
    expect(classes).not.toContain("border");
    expect(classes).not.toContain("border-border-strong");
  });

  it("explicit disabled renders native disabled", () => {
    const markup = render({ disabled: true, children: "Go" });
    expect(markup).toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("explicit disabled does not generate redundant aria-disabled", () => {
    const markup = render({ disabled: true, children: "Go" });
    expect(markup).not.toContain("aria-disabled");
  });

  it("disabled includes token-driven opacity and not-allowed cursor", () => {
    const classes = classListOf(render({ disabled: true, children: "Go" }));
    expect(classes).toContain("cursor-not-allowed");
    expect(classes).toContain("opacity-[var(--action-disabled-opacity)]");
  });

  it("disabled omits Button-owned hover and active classes", () => {
    const classes = classListOf(render({ disabled: true, children: "Go" }));
    expect(classes).not.toContain("hover:bg-action-primary-hover");
    expect(classes).not.toContain("active:bg-action-primary-active");
  });

  it("loading alone does not render native disabled", () => {
    const markup = render({ loading: true, children: "Go" });
    expect(markup).not.toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("loading forces aria-disabled and aria-busy", () => {
    const markup = render({ loading: true, children: "Go" });
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('aria-busy="true"');
  });

  it("loading remains focusable, evidenced by the absence of native disabled", () => {
    const markup = render({ loading: true, children: "Go" });
    expect(markup).not.toMatch(/\sdisabled(=""|\s|>)/);
  });

  it("loading prevents the caller's onClick", () => {
    const onClick = vi.fn();
    const element = Button({ loading: true, onClick, children: "Go" });
    const preventDefault = vi.fn();
    element.props.onClick({ preventDefault } as unknown as MouseEvent<HTMLButtonElement>);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading calls preventDefault", () => {
    const element = Button({ loading: true, children: "Go" });
    const preventDefault = vi.fn();
    element.props.onClick({ preventDefault } as unknown as MouseEvent<HTMLButtonElement>);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("a loading submit Button prevents the click default action", () => {
    const element = Button({ loading: true, type: "submit", children: "Go" });
    const preventDefault = vi.fn();
    element.props.onClick({ preventDefault } as unknown as MouseEvent<HTMLButtonElement>);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("non-loading click calls the caller handler without preventing default", () => {
    const onClick = vi.fn();
    const element = Button({ loading: false, onClick, children: "Go" });
    const preventDefault = vi.fn();
    const fakeEvent = { preventDefault } as unknown as MouseEvent<HTMLButtonElement>;
    element.props.onClick(fakeEvent);
    expect(onClick).toHaveBeenCalledWith(fakeEvent);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("loading omits Button-owned hover and active classes", () => {
    const classes = classListOf(render({ loading: true, children: "Go" }));
    expect(classes).not.toContain("hover:bg-action-primary-hover");
    expect(classes).not.toContain("active:bg-action-primary-active");
  });

  it("disabled plus loading retains native disabled and aria-busy", () => {
    const markup = render({ disabled: true, loading: true, children: "Go" });
    expect(markup).toMatch(/\sdisabled(=""|\s|>)/);
    expect(markup).toContain('aria-busy="true"');
  });

  it("disabled plus loading does not generate aria-disabled", () => {
    const markup = render({ disabled: true, loading: true, children: "Go" });
    expect(markup).not.toContain("aria-disabled");
  });

  it("children remain unchanged during loading", () => {
    const markup = render({ loading: true, children: "Click me" });
    expect(markup).toContain("Click me");
  });

  it("renders no spinner or invented loading copy", () => {
    const markup = render({ loading: true, children: "Click me" });
    const inner = markup.replace(/^<button[^>]*>/, "").replace(/<\/button>$/, "");
    expect(inner).toBe("Click me");
  });

  it("never applies pointer-events-none", () => {
    for (const variant of VARIANTS) {
      for (const state of [{}, { disabled: true }, { loading: true }, { disabled: true, loading: true }]) {
        const classes = classListOf(render({ variant, children: "Go", ...state }));
        expect(classes).not.toContain("pointer-events-none");
      }
    }
  });

  it("does not forward loading or variant to rendered DOM markup", () => {
    const markup = render({ loading: true, variant: "secondary", children: "Go" });
    expect(markup).not.toContain("loading=");
    expect(markup).not.toContain("variant=");
  });
});
