import { describe, expect, it } from "vitest";
import { aggregate } from "./aggregate";
import { toMarkdown } from "./markdown";
import type { Commit, PullRequest } from "./types";
import { weekFrom } from "./week";

const week = weekFrom("2026-10-23", "Africa/Addis_Ababa");

const commit = (i: number): Commit => ({
  oid: `abcdef${i}000`,
  message: `change ${i}`,
  committedDate: "2026-10-24T10:00:00Z",
  url: "u",
  additions: 1,
  deletions: 0,
});

const pr = (number: number, p: Partial<PullRequest>): PullRequest => ({
  number,
  title: `PR ${number}`,
  body: "",
  url: `https://github.com/o/a/pull/${number}`,
  repo: "o/a",
  state: "OPEN",
  isDraft: false,
  createdAt: "2026-10-24T08:00:00Z",
  mergedAt: null,
  closedAt: null,
  additions: 0,
  deletions: 0,
  ...p,
});

describe("toMarkdown", () => {
  it("renders headline, PR groups, and caps commits", () => {
    const stats = aggregate(
      [{ repo: "o/a", snapshot: { branches: ["main"], commits: Array.from({ length: 12 }, (_, i) => commit(i)), releases: [] } }],
      {
        prs: [
          pr(1, { state: "MERGED", mergedAt: "2026-10-24T11:00:00Z", closedAt: "2026-10-24T11:00:00Z" }),
          pr(2, { isDraft: true }),
        ],
        reviews: [],
        issues: [],
      },
      week,
    );
    const md = toMarkdown(stats, week, { author: "Semere", narrative: "Shipped things." });

    expect(md).toMatch(/^# Weekly update — Semere — Oct 23 – 29, 2026\n\nShipped things\.\n\n/);
    expect(md).toContain("**12 commits · 1 PR merged · 1 repo**");
    expect(md).toContain("**Merged**\n- [#1](https://github.com/o/a/pull/1) PR 1 _(3h)_");
    expect(md).toContain("**Draft**\n- [#2]");
    expect(md).toContain("**Commits** (12)");
    expect(md).toContain("- …and 2 more");
    expect(md).not.toMatch(/\n{3,}/);
  });

  it("handles an empty week", () => {
    const md = toMarkdown(aggregate([], { prs: [], reviews: [], issues: [] }, week), week);
    expect(md).toContain("_No activity this week._");
  });
});
