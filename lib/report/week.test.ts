import { describe, expect, it } from "vitest";
import { addDays, daysOf, localDate, localMidnight, previousWeek, weekContaining } from "./week";

const ADDIS = "Africa/Addis_Ababa"; // UTC+3, no DST
const FRI = 5;

describe("week windows", () => {
  it("local midnight in Addis is 21:00 UTC the previous day", () => {
    expect(localMidnight("2026-10-23", ADDIS).toISOString()).toBe("2026-10-22T21:00:00.000Z");
  });

  it("finds the Fri–Thu week containing a mid-week instant", () => {
    const w = weekContaining(new Date("2026-10-28T10:00:00Z"), ADDIS, FRI); // Wed
    expect(w.startDate).toBe("2026-10-23");
    expect(w.endDate).toBe("2026-10-29");
    expect(w.start.toISOString()).toBe("2026-10-22T21:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-10-29T21:00:00.000Z");
  });

  it("uses the local date, not UTC, at the week boundary", () => {
    // Thu 22:30 UTC = Fri 01:30 in Addis: already the next week.
    expect(weekContaining(new Date("2026-10-29T22:30:00Z"), ADDIS, FRI).startDate).toBe("2026-10-30");
    // Thu 20:59 UTC = Thu 23:59 in Addis: still the old week.
    expect(weekContaining(new Date("2026-10-29T20:59:00Z"), ADDIS, FRI).startDate).toBe("2026-10-23");
  });

  it("a week-start day maps to its own week", () => {
    expect(weekContaining(new Date("2026-10-30T09:00:00Z"), ADDIS, FRI).startDate).toBe("2026-10-30");
  });

  it("supports other start days (Monday)", () => {
    expect(weekContaining(new Date("2026-10-28T10:00:00Z"), ADDIS, 1).startDate).toBe("2026-10-26");
  });

  it("handles DST zones", () => {
    // Europe/Berlin leaves DST on Sun 2026-10-25, inside the Fri 23 – Thu 29 week: it spans 7 days + 1h.
    const w = weekContaining(new Date("2026-10-28T10:00:00Z"), "Europe/Berlin", FRI);
    expect(w.start.toISOString()).toBe("2026-10-22T22:00:00.000Z"); // 00:00 CEST (+2)
    expect(w.end.toISOString()).toBe("2026-10-29T23:00:00.000Z"); // 00:00 CET (+1)
  });

  it("previous week and days", () => {
    const w = weekContaining(new Date("2026-10-28T10:00:00Z"), ADDIS, FRI);
    expect(previousWeek(w).startDate).toBe("2026-10-16");
    expect(daysOf(w)).toEqual(Array.from({ length: 7 }, (_, i) => addDays("2026-10-23", i)));
    expect(localDate(new Date("2026-10-22T21:00:00Z"), ADDIS)).toBe("2026-10-23");
  });
});
