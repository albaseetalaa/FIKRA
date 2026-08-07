import { describe, expect, it } from "vitest";
import { BUDGET_RANGE_OPTIONS, LAUNCH_TIMELINE_OPTIONS, findLaunchTimelineOption } from "./budgetTimelineOptions";

describe("LAUNCH_TIMELINE_OPTIONS canonical semantics", () => {
  it("asap has mode 'asap' and a null day count — never fabricates 14 days", () => {
    const option = findLaunchTimelineOption("asap");
    expect(option?.mode).toBe("asap");
    expect(option?.days).toBeNull();
  });

  it("flexible has mode 'flexible' and a null day count — never fabricates 365 days", () => {
    const option = findLaunchTimelineOption("flexible");
    expect(option?.mode).toBe("flexible");
    expect(option?.days).toBeNull();
  });

  it("within_30_days has mode 'fixed' and days 30", () => {
    const option = findLaunchTimelineOption("within_30_days");
    expect(option?.mode).toBe("fixed");
    expect(option?.days).toBe(30);
  });

  it("within_3_months has mode 'fixed' and days 90", () => {
    const option = findLaunchTimelineOption("within_3_months");
    expect(option?.mode).toBe("fixed");
    expect(option?.days).toBe(90);
  });

  it("within_6_months has mode 'fixed' and days 180", () => {
    const option = findLaunchTimelineOption("within_6_months");
    expect(option?.mode).toBe("fixed");
    expect(option?.days).toBe(180);
  });

  it("every fixed option has a non-null day count, and every non-fixed option has a null day count", () => {
    for (const option of LAUNCH_TIMELINE_OPTIONS) {
      if (option.mode === "fixed") {
        expect(option.days).not.toBeNull();
      } else {
        expect(option.days).toBeNull();
      }
    }
  });

  it("no option maps asap to 14 or flexible to 365", () => {
    const asap = findLaunchTimelineOption("asap");
    const flexible = findLaunchTimelineOption("flexible");
    expect(asap?.days).not.toBe(14);
    expect(flexible?.days).not.toBe(365);
  });
});

describe("BUDGET_RANGE_OPTIONS unaffected by the timeline contract change", () => {
  it("under_5000 still has max 5000 and no currency token", () => {
    const option = BUDGET_RANGE_OPTIONS.find((o) => o.id === "under_5000");
    expect(option?.max).toBe(5000);
    expect(option?.label).not.toMatch(/SAR|JOD|USD/);
  });
});
