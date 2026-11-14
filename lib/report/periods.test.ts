import { describe, expect, it } from "vitest";
import { isPeriodKey, periodKey, periodLabel } from "./periods";

describe("periods", () => {
  it("files a week under the period its start day falls in", () => {
    expect(periodKey("2026-10-30", "month")).toBe("2026-10"); // Oct 30 – Nov 5 counts as October
    expect(periodKey("2026-10-30", "quarter")).toBe("2026-Q4");
    expect(periodKey("2026-03-30", "quarter")).toBe("2026-Q1");
    expect(periodKey("2026-04-03", "quarter")).toBe("2026-Q2");
    expect(periodKey("2026-12-31", "year")).toBe("2026");
  });

  it("labels and validates keys", () => {
    expect(periodLabel("2026-11")).toBe("November 2026");
    expect(periodLabel("2026-Q4")).toBe("Q4 2026");
    expect(periodLabel("2026")).toBe("2026");
    expect(isPeriodKey("2026-11", "month")).toBe(true);
    expect(isPeriodKey("2026-13", "month")).toBe(false);
    expect(isPeriodKey("2026-Q5", "quarter")).toBe(false);
    expect(isPeriodKey("2026-11", "year")).toBe(false);
  });
});
