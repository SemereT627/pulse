import "server-only";
import type { Source } from "@/db/schema";
import type { Commit, Issue, PullRequest, Release, RepoSnapshot, Review, UserSnapshot } from "@/lib/report/types";
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

function historyArgs(after?: string | null) {
  return `first: ${PAGE}, since: $since, until: $until, author: { id: $me }${after ? `, after: ${JSON.stringify(after)}` : ""}`;
}

function refAlias(alias: string, source: Source, branch: string, after?: string | null) {
  return `${alias}: repository(owner: ${JSON.stringify(source.owner)}, name: ${JSON.stringify(source.name)}) {
    ref(qualifiedName: ${JSON.stringify(`refs/heads/${branch}`)}) {
      target { ... on Commit { history(${historyArgs(after)}) { ${HISTORY_FIELDS} } } }
    }
  }`;
}

export async function fetchRepoSnapshots(
  sources: Source[],
  week: WeekWindow,
  viewerId: string,
): Promise<Map<number, RepoSnapshot>> {
  const result = new Map<number, RepoSnapshot>();
  const vars = { since: week.start.toISOString(), until: week.end.toISOString(), me: viewerId };

  for (let i = 0; i < sources.length; i += REPOS_PER_QUERY) {
    const chunk = sources.slice(i, i + REPOS_PER_QUERY);
    const fields: string[] = [];
    chunk.forEach((s, si) => {
      branchesFor(s).forEach((b, bi) => fields.push(refAlias(`c${si}_${bi}`, s, b)));
      fields.push(`r${si}: repository(owner: ${JSON.stringify(s.owner)}, name: ${JSON.stringify(s.name)}) {
        releases(first: 20, orderBy: { field: CREATED_AT, direction: DESC }) {
          nodes { name tagName publishedAt url author { id } }
        }
      }`);
    });

    const data = await gh<Record<string, unknown>>(
      `query ($since: GitTimestamp!, $until: GitTimestamp!, $me: ID!) { ${fields.join("\n")} ${RATE_LIMIT_FIELDS} }`,
      vars,
    );

    for (const [si, s] of chunk.entries()) {
      const branches = branchesFor(s);
      const commits: Commit[] = [];
      for (const [bi, b] of branches.entries()) {
        let conn = (data[`c${si}_${bi}`] as { ref: RefResult } | null)?.ref?.target?.history;
        while (conn) {
          commits.push(...conn.nodes.map(toCommit));
          if (!conn.pageInfo.hasNextPage) break;
          const next = await gh<{ c: { ref: RefResult } }>(
            `query ($since: GitTimestamp!, $until: GitTimestamp!, $me: ID!) { ${refAlias("c", s, b, conn.pageInfo.endCursor)} ${RATE_LIMIT_FIELDS} }`,
            vars,
          );
          conn = next.c?.ref?.target?.history;
        }
      }

      type ReleaseNode = Release & { author: { id: string } | null };
      const releaseNodes = (data[`r${si}`] as { releases: { nodes: ReleaseNode[] } } | null)?.releases.nodes ?? [];
      const releases = releaseNodes
        .filter((r) => r.author?.id === viewerId && r.publishedAt)
        .map(({ name, tagName, publishedAt, url }) => ({ name, tagName, publishedAt, url }));

      result.set(s.id, { branches, commits, releases });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Account-wide: PRs authored, reviews given, issues — filtered to included repos later.
// ---------------------------------------------------------------------------

export async function fetchViewer(): Promise<{ id: string; login: string }> {
  const data = await gh<{ viewer: { id: string; login: string } }>(`query { viewer { id login } ${RATE_LIMIT_FIELDS} }`);
  return data.viewer;
}

type SearchPage<T> = { search: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: T[] } };

async function searchAll<T>(query: string, fragment: string): Promise<T[]> {
  const out: T[] = [];
  let after: string | null = null;
  do {
    const page: SearchPage<T> = await gh<SearchPage<T>>(
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

export async function fetchUserSnapshot(week: WeekWindow, viewer: { id: string; login: string }): Promise<UserSnapshot> {
  type PrNode = Omit<PullRequest, "repo"> & { repository: { nameWithOwner: string } };
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
            pullRequest: { number: number; title: string; url: string; repository: { nameWithOwner: string } };
          }[];
        };
      };
    };
  };

  const [prNodes, issueNodes, reviewData] = await Promise.all([
    // `updated:` (not `created:`) so PRs opened earlier but merged/closed this week are included.
    searchAll<PrNode>(
      `is:pr author:${viewer.login} updated:${range(week)}`,
      `... on PullRequest {
        number title body url state isDraft createdAt mergedAt closedAt additions deletions
        repository { nameWithOwner }
      }`,
    ),
    searchAll<IssueNode>(
      `is:issue involves:${viewer.login} updated:${range(week)}`,
      `... on Issue {
        number title url createdAt closedAt
        author { login }
        assignees(first: 10) { nodes { login } }
        repository { nameWithOwner }
      }`,
    ),
    gh<ReviewData>(
      `query ($from: DateTime!, $to: DateTime!) {
        viewer {
          contributionsCollection(from: $from, to: $to) {
            pullRequestReviewContributions(first: 100) {
              nodes {
                occurredAt
                pullRequestReview { state }
                pullRequest { number title url repository { nameWithOwner } }
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
  const prs: PullRequest[] = prNodes.map(({ repository, body, ...pr }) => ({
    ...pr,
    body: (body ?? "").trim().slice(0, 2000),
    repo: repository.nameWithOwner,
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
  }));

  return { prs, reviews, issues };
}
