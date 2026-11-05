import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { settings, sources, type User } from "@/db/schema";
import { gh, RATE_LIMIT_FIELDS } from "./client";

const REPOS_QUERY = `
  query ($after: String) {
    viewer {
      repositories(
        first: 100
        after: $after
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          name
          owner { login }
          isPrivate
          isArchived
          pushedAt
          defaultBranchRef { name }
        }
      }
    }
    ${RATE_LIMIT_FIELDS}
  }
`;

type RepoNode = {
  id: string;
  name: string;
  owner: { login: string };
  isPrivate: boolean;
  isArchived: boolean;
  pushedAt: string | null;
  defaultBranchRef: { name: string } | null;
};

type ReposPage = {
  viewer: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: RepoNode[];
    };
  };
};

export async function listAccessibleRepos(user: User): Promise<RepoNode[]> {
  const repos: RepoNode[] = [];
  let after: string | null = null;
  do {
    const page: ReposPage = await gh<ReposPage>(user, REPOS_QUERY, { after });
    repos.push(...page.viewer.repositories.nodes);
    after = page.viewer.repositories.pageInfo.hasNextPage ? page.viewer.repositories.pageInfo.endCursor : null;
  } while (after);
  return repos;
}

/** Upsert every accessible repo; keeps the user's `included` / `extraBranches` choices. */
export async function syncSources(user: User): Promise<number> {
  const [repos, [config]] = await Promise.all([
    listAccessibleRepos(user),
    db.select().from(settings).where(eq(settings.userId, user.id)),
  ]);
  if (repos.length === 0) return 0;

  await db
    .insert(sources)
    .values(
      repos.map((r) => ({
        userId: user.id,
        githubNodeId: r.id,
        owner: r.owner.login,
        name: r.name,
        isPrivate: r.isPrivate,
        isArchived: r.isArchived,
        defaultBranch: r.defaultBranchRef?.name ?? null,
        pushedAt: r.pushedAt ? new Date(r.pushedAt) : null,
        // Only applies to newly seen repos; the conflict update below leaves existing choices alone.
        ...(config && { extraBranches: config.defaultExtraBranches }),
      })),
    )
    .onConflictDoUpdate({
      target: [sources.userId, sources.githubNodeId],
      set: {
        owner: sql`excluded.owner`,
        name: sql`excluded.name`,
        isPrivate: sql`excluded.is_private`,
        isArchived: sql`excluded.is_archived`,
        defaultBranch: sql`excluded.default_branch`,
        pushedAt: sql`excluded.pushed_at`,
        updatedAt: sql`now()`,
      },
    });

  return repos.length;
}

/** A new user has no repos listed yet: load them from GitHub once, so picking repos isn't an empty list. */
export async function syncIfEmpty(user: User) {
  const [any] = await db.select({ id: sources.id }).from(sources).where(eq(sources.userId, user.id)).limit(1);
  if (any) return;
  await syncSources(user).catch((e) => console.error("first repo sync failed", e));
}
