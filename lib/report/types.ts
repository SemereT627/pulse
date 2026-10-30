// Shapes stored in snapshots.data (raw-ish GitHub data) and produced by aggregation.

export type Commit = {
  oid: string;
  message: string;
  committedDate: string;
  url: string;
  additions: number;
  deletions: number;
};

export type Release = { name: string | null; tagName: string; publishedAt: string; url: string };

export type RepoSnapshot = {
  /** Branches fetched, so a change in the source's branch config invalidates the cache. */
  branches: string[];
  commits: Commit[];
  releases: Release[];
};

export type PullRequest = {
  number: number;
  title: string;
  body: string;
  url: string;
  repo: string; // owner/name
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  /** Logins who reviewed this PR (latest review each). Missing in snapshots fetched before v2. */
  reviewers?: string[];
};

export type Review = {
  occurredAt: string;
  state: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  /** Missing in snapshots fetched before v2, or when the author is a bot or deleted account. */
  prAuthor?: string | null;
};

export type Issue = {
  number: number;
  title: string;
  url: string;
  repo: string;
  authoredByMe: boolean;
  assignedToMe: boolean;
  createdAt: string;
  closedAt: string | null;
};

/** Bump when UserSnapshot gains fields, so cached weeks refetch the user snapshot. */
export const USER_SNAPSHOT_VERSION = 2;

export type UserSnapshot = { v?: number; prs: PullRequest[]; reviews: Review[]; issues: Issue[] };

export type PrStatus = "merged" | "closed" | "open" | "draft";

export type RepoActivity = {
  repo: string;
  commits: Commit[];
  prs: (PullRequest & { status: PrStatus; hoursToMerge: number | null })[];
  releases: Release[];
  reviews: Review[];
  issuesClosed: Issue[];
  additions: number;
  deletions: number;
};

export type Totals = {
  commits: number;
  prsOpened: number;
  prsMerged: number;
  prsClosed: number;
  reviews: number;
  issuesOpened: number;
  issuesClosed: number;
  releases: number;
  additions: number;
  deletions: number;
  activeRepos: number;
  activeDays: number;
};

export type WeekStats = {
  totals: Totals;
  medianHoursToMerge: number | null;
  byDay: { date: string; commits: number; prs: number; reviews: number }[];
  repos: RepoActivity[];
};
