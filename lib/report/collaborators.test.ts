import { describe, expect, it } from "vitest";
import { collaborators, hasCollaboratorData } from "./collaborators";
import type { RepoActivity, Review } from "./types";

type Pr = RepoActivity["prs"][number];

const pr = (number: number, reviewers?: string[]): Pr => ({
  number,
  title: `PR ${number}`,
  body: "",
  url: `https://github.com/o/a/pull/${number}`,
  repo: "o/a",
  state: "MERGED",
  isDraft: false,
  createdAt: "2026-10-24T08:00:00Z",
  mergedAt: "2026-10-24T10:00:00Z",
  closedAt: "2026-10-24T10:00:00Z",
  additions: 0,
  deletions: 0,
  reviewers,
  status: "merged",
  hoursToMerge: 2,
});

const review = (prNumber: number, prAuthor: string | null | undefined, occurredAt = "2026-10-25T08:00:00Z"): Review => ({
  occurredAt,
  state: "APPROVED",
  repo: "o/b",
  prNumber,
  prTitle: `Theirs ${prNumber}`,
  prUrl: `https://github.com/o/b/pull/${prNumber}`,
  prAuthor,
});

const repo = (name: string, p: Partial<RepoActivity>): RepoActivity => ({
  repo: name,
  commits: [],
  prs: [],
  releases: [],
  reviews: [],
  issuesClosed: [],
  additions: 0,
  deletions: 0,
  ...p,
});

describe("collaborators", () => {
  it("combines my PRs' reviewers with authors of PRs I reviewed", () => {
    const result = collaborators([
      repo("o/a", { prs: [pr(1, ["ana", "ben"]), pr(2, ["ana"])] }),
      repo("o/b", { reviews: [review(7, "Ben"), review(8, "cy")] }),
    ]);
    expect(result.map((c) => c.login)).toEqual(["ana", "ben", "cy"]);
    expect(result[0].reviewedMine.map((l) => l.number)).toEqual([1, 2]);
    expect(result[1]).toMatchObject({ repos: ["o/a", "o/b"] });
    expect(result[1].iReviewed.map((l) => l.number)).toEqual([7]);
  });

  it("counts several reviews of one PR once and skips unknown authors", () => {
    const result = collaborators([
      repo("o/b", { reviews: [review(7, "ana"), review(7, "ana", "2026-10-26T08:00:00Z"), review(9, null)] }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].iReviewed).toHaveLength(1);
  });
});

describe("hasCollaboratorData", () => {
  it("is false when any PR or review predates reviewer tracking", () => {
    expect(hasCollaboratorData([repo("o/a", { prs: [pr(1, [])] })])).toBe(true);
    expect(hasCollaboratorData([repo("o/a", { prs: [pr(1)] })])).toBe(false);
    expect(hasCollaboratorData([repo("o/b", { reviews: [review(1, undefined)] })])).toBe(false);
    expect(hasCollaboratorData([])).toBe(true);
  });
});
