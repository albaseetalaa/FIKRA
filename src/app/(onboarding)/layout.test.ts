import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { getOptionalUserMock } = vi.hoisted(() => ({
  getOptionalUserMock: vi.fn(),
}));

vi.mock("@/lib/auth/getOptionalUser", () => ({
  getOptionalUser: getOptionalUserMock,
}));

import OnboardingLayout from "./layout";

describe("onboarding layout My Projects nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a My Projects link to /projects for an authenticated user", async () => {
    getOptionalUserMock.mockResolvedValue({ id: "user_test_1" });

    const element = await OnboardingLayout({ children: "wizard-content" });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('href="/projects"');
    expect(html).toContain("My Projects");
  });

  it("renders no My Projects link for an unauthenticated visitor", async () => {
    getOptionalUserMock.mockResolvedValue(null);

    const element = await OnboardingLayout({ children: "wizard-content" });
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain("My Projects");
  });

  it("always renders the page content regardless of auth state", async () => {
    getOptionalUserMock.mockResolvedValue(null);

    const element = await OnboardingLayout({ children: "wizard-content-marker" });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("wizard-content-marker");
  });
});
