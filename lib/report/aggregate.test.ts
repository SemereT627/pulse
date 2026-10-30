import { describe, expect, it } from "vitest";
import { aggregate, deltas, median, prStatus } from "./aggregate";
import type { Commit, PullRequest, RepoSnapshot, UserSnapshot } from "./types";
import { weekFrom } from "./week";

const week = weekFrom("2026-10-23", "Africa/Addis_Ababa"); // 2026-10-22T21:00Z .. 2026-10-29T21:00Z

const commit = (oid: string, committedDate: string, message = `change ${oid}`): Commit => ({
  oid,
  message,
  committedDate,
  url: `https://github.com/x/${oid}`,
  additions: 10,
  deletions: 2,
});

const pr = (n: number, p: Partial<PullRequest>): PullRequest => ({
  number: n,
  title: `PR ${n}`,
  body: "",
  url: `https://github.com/o/a/pull/${n}`,
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

const emptyUser: UserSnapshot = { prs: [], reviews: [], issues: [] };
const repo = (name: string, s: Partial<RepoSnapshot>) => ({
  repo: name,
  snapshot: { branches: ["main"], commits: [], releases: [], ...s },
});

describe("aggregate", () => {
  it("dedupes commits found on several branches and drops merge commits", () => {
    const c = commit("aaa", "2026-10-24T10:00:00Z");
    const stats = aggregate(
      [repo("o/a", { commits: [c, { ...c }, commit("bbb", "2026-10-25T10:00:00Z", "Merge branch 'dev' into main")] })],
      emptyUser,
      week,
    );
    expect(stats.totals.commits).toBe(1);
    expect(stats.totals.additions).toBe(10);
  });

  it("ignores commits outside the window (Addis-local boundaries)", () => {
    const stats = aggregate(
      [
        repo("o/a", {
          commits: [
            commit("before", "2026-10-22T20:59:59Z"), // Thu 23:59 Addis, previous week
            commit("first", "2026-10-22T21:00:00Z"), // Fri 00:00 Addis
            commit("after", "2026-10-29T21:00:00Z"), // next week
          ],
        }),
      ],
      emptyUser,
      week,
    );
    expect(stats.repos[0].commits.map((c) => c.oid)).toEqual(["first"]);
    expect(stats.byDay[0]).toMatchObject({ date: "2026-10-23", commits: 1 });
  });

  it("classifies PRs and computes time-to-merge", () => {
    const user: UserSnapshot = {
      ...emptyUser,
      prs: [
        pr(1, { state: "MERGED", createdAt: "2026-10-20T08:00:00Z", mergedAt: "2026-10-24T08:00:00Z", closedAt: "2026-10-24T08:00:00Z" }),
        pr(2, { state: "MERGED", createdAt: "2026-10-24T08:00:00Z", mergedAt: "2026-10-24T14:00:00Z", closedAt: "2026-10-24T14:00:00Z" }),
        pr(3, { state: "CLOSED", createdAt: "2026-10-25T08:00:00Z", closedAt: "2026-10-26T08:00:00Z" }),
        pr(4, { state: "OPEN", isDraft: true }),
        pr(5, { state: "MERGED", createdAt: "2026-10-01T08:00:00Z", mergedAt: "2026-10-02T08:00:00Z" }), // other week
        pr(6, { repo: "o/not-included", state: "MERGED", mergedAt: "2026-10-24T08:00:00Z" }),
      ],
    };
    const stats = aggregate([repo("o/a", {})], user, week);
    expect(stats.totals).toMatchObject({ prsOpened: 3, prsMerged: 2, prsClosed: 1, activeRepos: 1 });
    expect(stats.medianHoursToMerge).toBe(51); // median(96, 6)
    expect(stats.repos[0].prs.map((p) => [p.number, p.status])).toEqual([
      [3, "closed"],
      [2, "merged"],
      [4, "draft"],
      [1, "merged"],
    ]);
  });

  it("counts reviews and issues closed by me, in included repos only", () => {
    const user: UserSnapshot = {
      prs: [],
      reviews: [
        { occurredAt: "2026-10-26T09:00:00Z", state: "APPROVED", repo: "o/a", prNumber: 9, prTitle: "x", prUrl: "u" },
        { occurredAt: "2026-10-26T09:00:00Z", state: "APPROVED", repo: "o/other", prNumber: 9, prTitle: "x", prUrl: "u" },
      ],
      issues: [
        { number: 1, title: "i", url: "u", repo: "o/a", authoredByMe: true, assignedToMe: false, createdAt: "2026-10-24T00:00:00Z", closedAt: "2026-10-27T00:00:00Z" },
        { number: 2, title: "i", url: "u", repo: "o/a", authoredByMe: false, assignedToMe: false, createdAt: "2026-10-24T00:00:00Z", closedAt: "2026-10-27T00:00:00Z" },
      ],
    };
    const stats = aggregate([repo("o/a", {})], user, week);
    expect(stats.totals).toMatchObject({ reviews: 1, issuesOpened: 1, issuesClosed: 1 });
  });

  it("skips repos with no activity and orders active ones by activity", () => {
    const stats = aggregate(
      [
        repo("o/quiet", {}),
        repo("o/small", { commits: [commit("a", "2026-10-24T10:00:00Z")] }),
        repo("o/busy", { commits: ["b", "c", "d"].map((o) => commit(o, "2026-10-24T10:00:00Z")) }),
      ],
      emptyUser,
      week,
    );
    expect(stats.repos.map((r) => r.repo)).toEqual(["o/busy", "o/small"]);
  });
});

describe("helpers", () => {
  it("median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("prStatus prefers merged over closed", () => {
    expect(prStatus(pr(1, { state: "MERGED", mergedAt: "x" }))).toBe("merged");
    expect(prStatus(pr(1, { state: "CLOSED" }))).toBe("closed");
    expect(prStatus(pr(1, { isDraft: true }))).toBe("draft");
  });

  it("deltas", () => {
    const base = aggregate([], emptyUser, week).totals;
    expect(deltas({ ...base, commits: 12 }, { ...base, commits: 8 }).commits).toEqual({ value: 12, previous: 8, change: 4 });
  });
});
