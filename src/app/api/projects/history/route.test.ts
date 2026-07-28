import { describe, expect, it, vi } from "vitest";

const fixedIso = "2026-07-28T00:00:00.000Z";

vi.mock("@/lib/project-workflow/service", () => ({
  listProjectHistory: vi.fn(async () => [
    {
      id: "proj_test_1",
      name: "Test Project",
      ideaExcerpt: "Idea excerpt",
      status: "completed",
      createdAt: fixedIso,
      updatedAt: fixedIso,
    },
  ]),
}));

import { GET } from "./route";

describe("projects history route", () => {
  it("returns the typed items payload", async () => {
    const res = await GET();
    const body = (await res.json()) as { items?: unknown };

    expect(res.status).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);
    expect((body.items as Array<{ id: string }>)[0]?.id).toBe("proj_test_1");
  });
});
