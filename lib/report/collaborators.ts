import type { RepoActivity } from "./types";

export type CollabLink = { repo: string; number: number; title: string; url: string };

export type Collaborator = {
  login: string;
  /** My PRs this person reviewed. */
  reviewedMine: CollabLink[];
  /** Their PRs I reviewed (deduped by PR, so several reviews of one PR count once). */
  iReviewed: CollabLink[];
  repos: string[];
};

/**
 * People I worked with in a week, from my PRs' reviewers and the authors of PRs I reviewed.
 * Sorted by total interactions, then login.
 */
export function collaborators(repos: RepoActivity[]): Collaborator[] {
  const people = new Map<string, Collaborator>();
  const entry = (login: string) => {
    const key = login.toLowerCase();
    let c = people.get(key);
    if (!c) people.set(key, (c = { login, reviewedMine: [], iReviewed: [], repos: [] }));
    return c;
  };
  const addRepo = (c: Collaborator, repo: string) => {
    if (!c.repos.includes(repo)) c.repos.push(repo);
  };

  for (const r of repos) {
    for (const pr of r.prs) {
      for (const login of pr.reviewers ?? []) {
        const c = entry(login);
        c.reviewedMine.push({ repo: r.repo, number: pr.number, title: pr.title, url: pr.url });
        addRepo(c, r.repo);
      }
    }
    for (const rv of r.reviews) {
      if (!rv.prAuthor) continue;
      const c = entry(rv.prAuthor);
      if (c.iReviewed.some((l) => l.url === rv.prUrl)) continue;
      c.iReviewed.push({ repo: r.repo, number: rv.prNumber, title: rv.prTitle, url: rv.prUrl });
      addRepo(c, r.repo);
    }
  }

  const total = (c: Collaborator) => c.reviewedMine.length + c.iReviewed.length;
  return [...people.values()].sort((a, b) => total(b) - total(a) || a.login.localeCompare(b.login));
}

/** False when the week's data predates reviewer tracking, so an empty list means "unknown", not "nobody". */
export function hasCollaboratorData(repos: RepoActivity[]) {
  const prs = repos.flatMap((r) => r.prs);
  const reviews = repos.flatMap((r) => r.reviews);
  return prs.every((pr) => pr.reviewers !== undefined) && reviews.every((rv) => rv.prAuthor !== undefined);
}
