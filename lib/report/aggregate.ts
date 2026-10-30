import type {
  Issue,
  PrStatus,
  PullRequest,
  RepoActivity,
  RepoSnapshot,
  Totals,
  UserSnapshot,
  WeekStats,
} from "./types";
import { daysOf, localDate, type WeekWindow } from "./week";

const inWindow = (iso: string | null, week: WeekWindow) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= week.start.getTime() && t < week.end.getTime();
};

export function prStatus(pr: PullRequest): PrStatus {
  if (pr.mergedAt) return "merged";
  if (pr.state === "CLOSED") return "closed";
  return pr.isDraft ? "draft" : "open";
}

export function hoursBetween(from: string, to: string): number {
  return Math.round(((new Date(to).getTime() - new Date(from).getTime()) / 3_600_000) * 10) / 10;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** A PR is part of the week if it was opened, merged, or closed inside it, or is still open. */
function prTouchedWeek(pr: PullRequest, week: WeekWindow) {
  return (
    inWindow(pr.createdAt, week) ||
    inWindow(pr.mergedAt, week) ||
    inWindow(pr.closedAt, week) ||
    (pr.state === "OPEN" && new Date(pr.createdAt).getTime() < week.end.getTime())
  );
}

const issueClosedByMe = (i: Issue, week: WeekWindow) => (i.authoredByMe || i.assignedToMe) && inWindow(i.closedAt, week);

/** Branch-promotion PR config for a repo: PRs from a long-lived branch (`dev`) into the default branch. */
export type Promotion = { from: string[]; into: string | null };

/** A "Dev → main" style PR: it moves already-counted work between branches rather than adding any. */
export function isPromotionPr(pr: PullRequest, promotion: Promotion | undefined) {
  return !!promotion?.into && !!pr.headRefName && pr.baseRefName === promotion.into && promotion.from.includes(pr.headRefName);
}

export function aggregate(
  repoSnapshots: { repo: string; snapshot: RepoSnapshot; promotion?: Promotion }[],
  user: UserSnapshot,
  week: WeekWindow,
): WeekStats {
  const included = new Set(repoSnapshots.map((r) => r.repo));
  const promotions = new Map(repoSnapshots.map((r) => [r.repo, r.promotion]));
  const byRepo = new Map<string, RepoActivity>();
  const repoEntry = (repo: string) => {
    let entry = byRepo.get(repo);
    if (!entry) {
      entry = { repo, commits: [], prs: [], releases: [], reviews: [], issuesClosed: [], additions: 0, deletions: 0 };
      byRepo.set(repo, entry);
    }
    return entry;
  };

  for (const { repo, snapshot } of repoSnapshots) {
    const seen = new Set<string>();
    const commits = snapshot.commits
      .filter((c) => inWindow(c.committedDate, week) && !seen.has(c.oid) && seen.add(c.oid))
      .filter((c) => !/^merge (branch|pull request|remote-tracking)/i.test(c.message))
      .sort((a, b) => b.committedDate.localeCompare(a.committedDate));
    const releases = snapshot.releases.filter((r) => inWindow(r.publishedAt, week));
    if (commits.length === 0 && releases.length === 0) continue;

    const entry = repoEntry(repo);
    entry.commits = commits;
    entry.releases = releases;
    entry.additions = commits.reduce((n, c) => n + c.additions, 0);
    entry.deletions = commits.reduce((n, c) => n + c.deletions, 0);
  }

  const prs = user.prs.filter(
    (pr) => included.has(pr.repo) && prTouchedWeek(pr, week) && !isPromotionPr(pr, promotions.get(pr.repo)),
  );
  for (const pr of prs) {
    repoEntry(pr.repo).prs.push({
      ...pr,
      status: prStatus(pr),
      hoursToMerge: pr.mergedAt ? hoursBetween(pr.createdAt, pr.mergedAt) : null,
    });
  }

  const reviews = user.reviews.filter((r) => included.has(r.repo) && inWindow(r.occurredAt, week));
  for (const r of reviews) repoEntry(r.repo).reviews.push(r);

  const issues = user.issues.filter((i) => included.has(i.repo));
  const issuesClosed = issues.filter((i) => issueClosedByMe(i, week));
  for (const i of issuesClosed) repoEntry(i.repo).issuesClosed.push(i);

  const repos = [...byRepo.values()];
  for (const r of repos) r.prs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  repos.sort((a, b) => score(b) - score(a) || a.repo.localeCompare(b.repo));

  const commits = repos.flatMap((r) => r.commits);
  const merged = prs.filter((pr) => inWindow(pr.mergedAt, week));
  const days = daysOf(week);
  const dayOf = (iso: string) => localDate(new Date(iso), week.timezone);

  const byDay = days.map((date) => ({
    date,
    commits: commits.filter((c) => dayOf(c.committedDate) === date).length,
    prs: merged.filter((pr) => dayOf(pr.mergedAt!) === date).length,
    reviews: reviews.filter((r) => dayOf(r.occurredAt) === date).length,
  }));

  const totals: Totals = {
    commits: commits.length,
    prsOpened: prs.filter((pr) => inWindow(pr.createdAt, week)).length,
    prsMerged: merged.length,
    prsClosed: prs.filter((pr) => !pr.mergedAt && inWindow(pr.closedAt, week)).length,
    reviews: reviews.length,
    issuesOpened: issues.filter((i) => i.authoredByMe && inWindow(i.createdAt, week)).length,
    issuesClosed: issuesClosed.length,
    releases: repos.reduce((n, r) => n + r.releases.length, 0),
    additions: repos.reduce((n, r) => n + r.additions, 0),
    deletions: repos.reduce((n, r) => n + r.deletions, 0),
    activeRepos: repos.length,
    activeDays: byDay.filter((d) => d.commits + d.prs + d.reviews > 0).length,
  };

  return {
    totals,
    medianHoursToMerge: median(merged.map((pr) => hoursBetween(pr.createdAt, pr.mergedAt!))),
    byDay,
    repos,
  };
}

function score(r: RepoActivity) {
  return r.commits.length + r.prs.length * 3 + r.reviews.length * 2 + r.releases.length * 3;
}

export type Delta = { value: number; previous: number; change: number };

export function deltas(current: Totals, previous: Totals): Record<keyof Totals, Delta> {
  return Object.fromEntries(
    (Object.keys(current) as (keyof Totals)[]).map((k) => [
      k,
      { value: current[k], previous: previous[k], change: current[k] - previous[k] },
    ]),
  ) as Record<keyof Totals, Delta>;
}
