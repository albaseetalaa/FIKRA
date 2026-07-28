import { describe, expect, it } from "vitest";
import { getLoadedState, loadProjectHistoryItems } from "./historyClient";

const fixedIso = "2026-07-28T00:00:00.000Z";

describe("history client", () => {
  it("returns loading=false in loaded state", () => {
    const state = getLoadedState([
      {
        id: "proj_1",
        name: "Project One",
        ideaExcerpt: "A short idea",
        status: "completed",
        createdAt: fixedIso,
        updatedAt: fixedIso,
      },
    ]);

    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.items.length).toBe(1);
  });

  it("loads items from the expected API response shape", async () => {
    const fakeFetch: typeof fetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "proj_2",
              name: "Project Two",
              ideaExcerpt: "Another idea",
              status: "failed",
              createdAt: fixedIso,
              updatedAt: fixedIso,
            },
          ],
        }),
      }) as Response) as typeof fetch;

    const items = await loadProjectHistoryItems(fakeFetch);
    expect(items.length).toBe(1);
    expect(items[0]?.id).toBe("proj_2");
  });
});
