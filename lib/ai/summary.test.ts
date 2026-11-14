import { describe, expect, it } from "vitest";
import { periodSystemPrompt, periodUserPrompt, systemPrompt } from "./summary";
import type { WeekStats } from "@/lib/report/types";

describe("systemPrompt", () => {
  it("reflects tone and length", () => {
    const p = systemPrompt({ aiTone: "concise", aiLength: "short", aiInstructions: null });
    expect(p).toContain("plain and to the point");
    expect(p).toContain("1-2 short paragraphs");
    expect(p).not.toContain("Additional instructions");
  });

  it("appends the engineer's own instructions, ignoring blank ones", () => {
    expect(systemPrompt({ aiTone: "professional", aiLength: "medium", aiInstructions: "  " })).not.toContain(
      "Additional instructions",
    );
    expect(systemPrompt({ aiTone: "professional", aiLength: "medium", aiInstructions: "Mention OmniFleet by name." })).toContain(
      "Mention OmniFleet by name.",
    );
  });
});

describe("period prompts", () => {
  const totals = { commits: 3, prsMerged: 1, reviews: 2 } as WeekStats["totals"];
  const stats = (title: string): WeekStats =>
    ({ totals, repos: [{ repo: "o/a", prs: [{ title, status: "merged" }] }] }) as unknown as WeekStats;

  it("names the period and uses the length setting", () => {
    const p = periodSystemPrompt({ aiTone: "professional", aiLength: "short", aiInstructions: null }, "Q4 2026");
    expect(p).toContain("over Q4 2026");
    expect(p).toContain("2-3 paragraphs");
  });

  it("prefers a week's written update and falls back to its pull requests", () => {
    const p = periodUserPrompt([
      { weekStart: "2026-10-30", weekEnd: "2026-11-05", narrative: "Shipped OTA updates.", stats: stats("ignored") },
      { weekStart: "2026-11-06", weekEnd: "2026-11-12", narrative: null, stats: stats("Gzip OTA bundles") },
    ]);
    expect(p).toContain("Week 2026-10-30 to 2026-11-05 (3 commits, 1 PRs merged, 2 reviews):\nShipped OTA updates.");
    expect(p).not.toContain("ignored");
    expect(p).toContain("o/a: Gzip OTA bundles (merged)");
  });
});
