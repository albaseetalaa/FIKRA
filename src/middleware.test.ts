import {
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

import nextConfig from "../next.config";

const { updateSessionMock } = vi.hoisted(() => ({
  updateSessionMock: vi.fn(),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: updateSessionMock,
}));

import { config, middleware } from "./middleware";

describe("application middleware", () => {
  it("matches application pages and API routes", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: "https://fikra.test/projects",
      }),
    ).toBe(true);

    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: "https://fikra.test/api/projects/create",
      }),
    ).toBe(true);
  });

  it("excludes Next.js assets and image files", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: "https://fikra.test/_next/static/chunks/app.js",
      }),
    ).toBe(false);

    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: "https://fikra.test/brand-logo.png",
      }),
    ).toBe(false);
  });

  it("delegates requests to the Supabase session updater", async () => {
    const request = new NextRequest("https://fikra.test/projects");
    const expectedResponse = NextResponse.next();

    updateSessionMock.mockResolvedValueOnce(expectedResponse);

    await expect(middleware(request)).resolves.toBe(expectedResponse);
    expect(updateSessionMock).toHaveBeenCalledWith(request);
  });
});
