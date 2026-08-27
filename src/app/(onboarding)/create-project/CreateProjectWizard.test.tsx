// @vitest-environment jsdom
import React, { act } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardData } from "./types";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const completeData: WizardData = {
  idea: "I want to launch a healthy breakfast restaurant focused on egg sandwiches and fresh salads.",
  businessName: "Test Co",
  industry: "Restaurant & Food",
  country: "Jordan",
  city: "Amman",
  stage: "Planning",
  audience: "Young professionals",
  ageRange: "25-40",
  customerType: "Individuals",
  goals: ["Build a brand identity"],
  budget: "under_5000",
  timeline: "asap",
  currency: "JOD",
  currencyInputMode: "manual",
};

vi.mock("./draftStorage", () => ({
  loadDraft: vi.fn(() => completeData),
  saveDraft: vi.fn(() => true),
}));

// Required for React 19's act() to run without warning under Vitest's jsdom
// environment, which doesn't set this global the way Jest's jsdom preset does.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Reproduces the PR #25 recovery scenario deterministically: create
// succeeds, start fails. Manual verification against the live Vercel
// Preview could not observe this state (the attempt never produced a
// visible /api/projects/create request and the UI reset to step 1) —
// this test exercises the real component tree under a controlled,
// mocked network instead of depending on that live condition.
function mockFetchCreateOk(startBehavior: () => Promise<Response>) {
  return vi.fn(async (url: string) => {
    if (url === "/api/projects/create") {
      return new Response(JSON.stringify({ projectId: "proj_fixed_123", status: "created" }), {
        status: 200,
      });
    }
    if (url === "/api/projects/start") {
      return startBehavior();
    }
    throw new Error(`Unexpected fetch to ${url}`);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  pushMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderWizardAtReview() {
  const { default: CreateProjectWizard } = await import("./CreateProjectWizard");

  render(<CreateProjectWizard userId="user_test_1" />);

  // Draft is fully valid, so canContinue is true at every step — advance
  // from step 1 to step 6 (Review) via the real Continue button.
  for (let i = 0; i < 5; i++) {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  }
}

describe("CreateProjectWizard create-succeeded/start-failed recovery", () => {
  it("shows the recovery panel, hides Create, and never re-calls create on retry, once start fails with a network error", async () => {
    let startCallCount = 0;
    const fetchMock = mockFetchCreateOk(async () => {
      startCallCount++;
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    await renderWizardAtReview();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create My Project" }));
    });

    expect(startCallCount).toBe(1);
    expect(screen.getByText("Your project is safely saved.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create My Project" })).toBeNull();
    expect(screen.getByRole("button", { name: "Retry Start" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Project" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "My Projects" })).toBeTruthy();

    // Retry must call only /api/projects/start, never /api/projects/create again.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry Start" }));
    });

    expect(startCallCount).toBe(2);
    const createCalls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: unknown[]) => call[0] === "/api/projects/create",
    );
    expect(createCalls.length).toBe(1);
  });

  it("shows the recovery panel when start fails with a 503", async () => {
    const fetchMock = mockFetchCreateOk(async () =>
      new Response(JSON.stringify({ error: "Not ready yet.", code: "persistence_unavailable" }), {
        status: 503,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await renderWizardAtReview();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create My Project" }));
    });

    expect(screen.getByText("Your project is safely saved.")).toBeTruthy();
    expect(screen.getByText("Not ready yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create My Project" })).toBeNull();
  });

  it("navigates to the processing page when both create and start succeed", async () => {
    const fetchMock = mockFetchCreateOk(async () => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await renderWizardAtReview();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create My Project" }));
    });

    expect(pushMock).toHaveBeenCalledWith("/create-project/processing?projectId=proj_fixed_123");
  });
});
