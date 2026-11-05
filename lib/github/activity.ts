import "server-only";
import type { Source, User } from "@/db/schema";
import { USER_SNAPSHOT_VERSION, type Commit, type Issue, type PullRequest, type Release, type RepoSnapshot, type Review, type UserSnapshot } from "@/lib/report/types";
import type { WeekWindow } from "@/lib/report/week";
import { gh, RATE_LIMIT_FIELDS } from "./client";

const REPOS_PER_QUERY = 6;
const PAGE = 100;

export function branchesFor(source: Source): string[] {
  return [...new Set([source.defaultBranch, ...source.extraBranches].filter((b): b is string => !!b))];
}

// ---------------------------------------------------------------------------
// Per-repo: commits on each tracked branch + releases, batched with aliases.
// ---------------------------------------------------------------------------

const HISTORY_FIELDS = `
  totalCount
  pageInfo { hasNextPage endCursor }
  nodes { oid message committedDate url additions deletions }
`;

type HistoryConn = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: { oid: string; message: string; committedDate: string; url: string; additions: number; deletions: number }[];
};
type RefResult = { target: { history?: HistoryConn } | null } | null;

const toCommit = (n: HistoryConn["nodes"][number]): Commit => ({
  oid: n.oid,
  // `messageHeadline` truncates at ~70 chars; take the full first line instead.
  message: n.message.split("\n")[0].trim(),
  committedDate: n.committedDate,
  url: n.url,
  additions: n.additions,
  deletions: n.deletions,
});

function historyArgs(authorId: string, after?: string | null) {
  return `first: ${PAGE}, since: $since, until: $until, author: { id: ${JSON.stringify(authorId)} }${after ? `, after: ${JSON.stringify(after)}` : ""}`;
}

function refAlias(alias: string, source: Source, branch: string, authorId: string, after?: string | null) {
  return `${alias}: repository(owner: ${JSON.stringify(source.owner)}, name: ${JSON.stringify(source.name)}) {
    ref(qualifiedName: ${JSON.stringify(`refs/heads/${branch}`)}) {
      target { ... on Commit { history(${historyArgs(authorId, after)}) { ${HISTORY_FIELDS} } } }
    }
  }`;
}

/** GitHub node ids for logins; unknown logins are skipped. */
export async function fetchUserIds(user: User, logins: string[]): Promise<string[]> {
  if (logins.length === 0) return [];
  const fields = logins.map((l, i) => `u${i}: user(login: ${JSON.stringify(l)}) { id }`).join("\n");
  const data = await gh<Record<string, { id: string } | null>>(user, `query { ${fields} ${RATE_LIMIT_FIELDS} }`).catch(() => ({}));
  return logins.map((_, i) => (data as Record<string, { id: string } | null>)[`u${i}`]?.id).filter((id): id is string => !!id);
}

/**
 * Commits on each tracked branch by any of `authorIds` (the user first), plus the user's releases.
 * `extraAuthors` is recorded in the snapshot so changing it refetches.
 */
export async function fetchRepoSnapshots(
  user: User,
  sources: Source[],
  week: WeekWindow,
  authorIds: string[],
  extraAuthors: string[] = [],
): Promise<Map<number, RepoSnapshot>> {
  const result = new Map<number, RepoSnapshot>();
  const viewerId = authorIds[0];
  const vars = { since: week.start.toISOString(), until: week.end.toISOString() };
  const QUERY_VARS = "$since: GitTimestamp!, $until: GitTimestamp!";

  // Each extra author multiplies the aliases per repo, so fewer repos fit in one query.
  const perQuery = Math.max(1, Math.floor(REPOS_PER_QUERY / authorIds.length));
  for (let i = 0; i < sources.length; i += perQuery) {
    const chunk = sources.slice(i, i + perQuery);
    const fields: string[] = [];
    chunk.forEach((s, si) => {
      branchesFor(s).forEach((b, bi) =>
        authorIds.forEach((a, ai) => fields.push(refAlias(`c${si}_${bi}_${ai}`, s, b, a))),
      );
      fields.push(`r${si}: repository(owner: ${JSON.stringify(s.owner)}, name: ${JSON.stringify(s.name)}) {
        releases(first: 20, orderBy: { field: CREATED_AT, direction: DESC }) {
          nodes { name tagName publishedAt url author { id } }
        }
      }`);
    });

    const data = await gh<Record<string, unknown>>(
      user,
      `query (${QUERY_VARS}) { ${fields.join("\n")} ${RATE_LIMIT_FIELDS} }`,
      vars,
    );

    for (const [si, s] of chunk.entries()) {
      const branches = branchesFor(s);
      const commits: Commit[] = [];
      for (const [bi, b] of branches.entries()) {
        for (const [ai, a] of authorIds.entries()) {
          let conn = (data[`c${si}_${bi}_${ai}`] as { ref: RefResult } | null)?.ref?.target?.history;
          while (conn) {
            commits.push(...conn.nodes.map(toCommit));
            if (!conn.pageInfo.hasNextPage) break;
            const next = await gh<{ c: { ref: RefResult } }>(
              user,
              `query (${QUERY_VARS}) { ${refAlias("c", s, b, a, conn.pageInfo.endCursor)} ${RATE_LIMIT_FIELDS} }`,
              vars,
            );
            conn = next.c?.ref?.target?.history;
          }
        }
      }

      type ReleaseNode = Release & { author: { id: string } | null };
      const releaseNodes = (data[`r${si}`] as { releases: { nodes: ReleaseNode[] } } | null)?.releases.nodes ?? [];
      const releases = releaseNodes
        .filter((r) => r.author?.id === viewerId && r.publishedAt)
        .map(({ name, tagName, publishedAt, url }) => ({ name, tagName, publishedAt, url }));

      result.set(s.id, { branches, extraAuthors, commits, releases });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Account-wide: PRs authored, reviews given, issues — filtered to included repos later.
// ---------------------------------------------------------------------------

export async function fetchViewer(user: User): Promise<{ id: string; login: string }> {
  const data = await gh<{ viewer: { id: string; login: string } }>(user, `query { viewer { id login } ${RATE_LIMIT_FIELDS} }`);
  return data.viewer;
}

type SearchPage<T> = { search: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: T[] } };

async function searchAll<T>(user: User, query: string, fragment: string): Promise<T[]> {
  const out: T[] = [];
  let after: string | null = null;
  do {
    const page: SearchPage<T> = await gh<SearchPage<T>>(
      user,
      `query ($q: String!, $after: String) {
        search(type: ISSUE, query: $q, first: ${PAGE}, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { ${fragment} }
        }
        ${RATE_LIMIT_FIELDS}
      }`,
      { q: query, after },
    );
    out.push(...page.search.nodes.filter((n) => n && Object.keys(n).length > 0));
    after = page.search.pageInfo.hasNextPage ? page.search.pageInfo.endCursor : null;
  } while (after);
  return out;
}

const range = (week: WeekWindow) => `${week.start.toISOString().slice(0, 19)}Z..${week.end.toISOString().slice(0, 19)}Z`;

export async function fetchUserSnapshot(user: User, week: WeekWindow, viewer: { id: string; login: string }): Promise<UserSnapshot> {
  type Author = { __typename: string; login: string } | null;
  type PrNode = Omit<PullRequest, "repo" | "reviewers"> & {
    repository: { nameWithOwner: string };
    latestReviews: { nodes: { author: Author }[] };
  };
  type IssueNode = {
    number: number;
    title: string;
    url: string;
    createdAt: string;
    closedAt: string | null;
    author: { login: string } | null;
    assignees: { nodes: { login: string }[] };
    repository: { nameWithOwner: string };
  };
  type ReviewData = {
    viewer: {
      contributionsCollection: {
        pullRequestReviewContributions: {
          nodes: {
            occurredAt: string;
            pullRequestReview: { state: string };
            pullRequest: {
              number: number;
              title: string;
              url: string;
              author: Author;
              repository: { nameWithOwner: string };
            };
          }[];
        };
      };
    };
  };

  const [prNodes, issueNodes, reviewData] = await Promise.all([
    // `updated:` (not `created:`) so PRs opened earlier but merged/closed this week are included.
    searchAll<PrNode>(
      user,
      `is:pr author:${viewer.login} updated:${range(week)}`,
      `... on PullRequest {
        number title body url state isDraft createdAt mergedAt closedAt additions deletions headRefName baseRefName
        repository { nameWithOwner }
        latestReviews(first: 20) { nodes { author { __typename login } } }
      }`,
    ),
    searchAll<IssueNode>(
      user,
      `is:issue involves:${viewer.login} updated:${range(week)}`,
      `... on Issue {
        number title url createdAt closedAt
        author { login }
        assignees(first: 10) { nodes { login } }
        repository { nameWithOwner }
      }`,
    ),
    gh<ReviewData>(
      user,
      `query ($from: DateTime!, $to: DateTime!) {
        viewer {
          contributionsCollection(from: $from, to: $to) {
            pullRequestReviewContributions(first: 100) {
              nodes {
                occurredAt
                pullRequestReview { state }
                pullRequest { number title url author { __typename login } repository { nameWithOwner } }
              }
            }
          }
        }
        ${RATE_LIMIT_FIELDS}
      }`,
      { from: week.start.toISOString(), to: new Date(week.end.getTime() - 1000).toISOString() },
    ),
  ]);

  const me = viewer.login.toLowerCase();
  // Bots (dependabot, review apps) aren't people you worked with.
  const person = (a: Author) => (a?.__typename === "User" && a.login.toLowerCase() !== me ? a.login : null);
  const prs: PullRequest[] = prNodes.map(({ repository, body, latestReviews, ...pr }) => ({
    ...pr,
    body: (body ?? "").trim().slice(0, 2000),
    repo: repository.nameWithOwner,
    reviewers: [...new Set(latestReviews.nodes.map((r) => person(r.author)).filter((l) => l !== null))],
  }));
  const issues: Issue[] = issueNodes.map((i) => ({
    number: i.number,
    title: i.title,
    url: i.url,
    repo: i.repository.nameWithOwner,
    authoredByMe: i.author?.login.toLowerCase() === me,
    assignedToMe: i.assignees.nodes.some((a) => a.login.toLowerCase() === me),
    createdAt: i.createdAt,
    closedAt: i.closedAt,
  }));
  const reviews: Review[] = reviewData.viewer.contributionsCollection.pullRequestReviewContributions.nodes.map((n) => ({
    occurredAt: n.occurredAt,
    state: n.pullRequestReview.state,
    repo: n.pullRequest.repository.nameWithOwner,
    prNumber: n.pullRequest.number,
    prTitle: n.pullRequest.title,
    prUrl: n.pullRequest.url,
    prAuthor: person(n.pullRequest.author),
  }));

  return { v: USER_SNAPSHOT_VERSION, prs, reviews, issues };
}
