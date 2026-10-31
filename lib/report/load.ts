import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimit, settings, snapshots, sources, type Source } from "@/db/schema";
import { branchesFor, fetchRepoSnapshots, fetchUserIds, fetchUserSnapshot, fetchViewer } from "@/lib/github/activity";
import { aggregate } from "./aggregate";
import { USER_SNAPSHOT_VERSION, type RepoSnapshot, type UserSnapshot, type WeekStats } from "./types";
import type { WeekWindow } from "./week";

// A week still in progress (or fetched before it ended) is refetched once its snapshot is this old.
const LIVE_TTL_MS = 15 * 60 * 1000;

export async function getSettings() {
  const [row] = await db.insert(settings).values({ id: 1 }).onConflictDoNothing().returning();
  return row ?? (await db.select().from(settings).where(eq(settings.id, 1)))[0];
}

export async function getRateLimit() {
  const [row] = await db.select().from(rateLimit).where(eq(rateLimit.id, 1));
  return row ?? null;
}

export async function includedSources(): Promise<Source[]> {
  return db.select().from(sources).where(eq(sources.included, true));
}

type Snap = { data: unknown; fetchedAt: Date };

function isStale(snap: Snap | undefined, week: WeekWindow, now: number) {
  if (!snap) return true;
  const fetchedBeforeWeekEnded = snap.fetchedAt.getTime() < week.end.getTime();
  return fetchedBeforeWeekEnded && now - snap.fetchedAt.getTime() > LIVE_TTL_MS;
}

const sameBranches = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

async function saveSnapshots(rows: { key: string; weekStart: string; data: unknown }[]) {
  if (rows.length === 0) return;
  await db
    .insert(snapshots)
    .values(rows)
    .onConflictDoUpdate({
      target: [snapshots.key, snapshots.weekStart],
      set: { data: sql`excluded.data`, fetchedAt: sql`now()` },
    });
}

export type LoadedWeek = {
  stats: WeekStats;
  sources: Source[];
  fetchedAt: Date | null;
  /** Set when GitHub couldn't be reached and the stats come from older (or missing) snapshots. */
  fetchError: string | null;
};

/**
 * Stats for one week, from cached snapshots where fresh, fetching from GitHub otherwise.
 * `cutoff` limits aggregation to activity before that instant (snapshots still cover the whole week).
 */
export async function loadWeek(week: WeekWindow, opts: { sources?: Source[]; cutoff?: Date } = {}): Promise<LoadedWeek> {
  const [included, settings] = await Promise.all([opts.sources ?? includedSources(), getSettings()]);
  const extraAuthors = [...settings.extraAuthorLogins].sort();
  const keys = ["user", ...included.map((s) => `repo:${s.id}`)];
  const cached = keys.length
    ? await db
        .select()
        .from(snapshots)
        .where(and(eq(snapshots.weekStart, week.startDate), inArray(snapshots.key, keys)))
    : [];
  const byKey = new Map(cached.map((s) => [s.key, s]));
  const now = Date.now();

  const staleSources = included.filter((s) => {
    const snap = byKey.get(`repo:${s.id}`);
    const data = snap?.data as RepoSnapshot | undefined;
    return (
      isStale(snap, week, now) ||
      !sameBranches(data!.branches, branchesFor(s)) ||
      !sameBranches(data!.extraAuthors ?? [], extraAuthors)
    );
  });
  const cachedUser = byKey.get("user");
  const userStale = isStale(cachedUser, week, now) || (cachedUser!.data as UserSnapshot).v !== USER_SNAPSHOT_VERSION;

  let fetchError: string | null = null;
  if (staleSources.length > 0 || userStale) {
    try {
      await refetch();
    } catch (e) {
      // Offline or GitHub down: fall back to what's cached rather than failing the page. Nothing cached = nothing to show.
      if (byKey.size === 0) throw e;
      fetchError = e instanceof Error ? e.message : "GitHub request failed";
      console.error(`loadWeek ${week.startDate}: using cached snapshots`, e);
    }
  }

  async function refetch() {
    const [viewer, extraIds] = await Promise.all([fetchViewer(), staleSources.length ? fetchUserIds(extraAuthors) : []]);
    const authorIds = [viewer.id, ...extraIds.filter((id) => id !== viewer.id)];
    const [repoSnaps, userSnap] = await Promise.all([
      staleSources.length
        ? fetchRepoSnapshots(staleSources, week, authorIds, extraAuthors)
        : new Map<number, RepoSnapshot>(),
      userStale ? fetchUserSnapshot(week, viewer) : null,
    ]);

    const rows: { key: string; weekStart: string; data: RepoSnapshot | UserSnapshot }[] = [...repoSnaps].map(
      ([id, data]) => ({ key: `repo:${id}`, weekStart: week.startDate, data }),
    );
    if (userSnap) rows.push({ key: "user", weekStart: week.startDate, data: userSnap });
    await saveSnapshots(rows);

    const fetchedAt = new Date();
    for (const r of rows) byKey.set(r.key, { ...byKey.get(r.key)!, key: r.key, data: r.data, fetchedAt });
  }

  const stats = aggregate(
    included.map((s) => ({
      repo: `${s.owner}/${s.name}`,
      snapshot: (byKey.get(`repo:${s.id}`)?.data as RepoSnapshot) ?? { branches: [], commits: [], releases: [] },
      promotion: settings.excludePromotionPrs ? { from: s.extraBranches, into: s.defaultBranch } : undefined,
    })),
    (byKey.get("user")?.data as UserSnapshot) ?? { prs: [], reviews: [], issues: [] },
    opts.cutoff && opts.cutoff < week.end ? { ...week, end: opts.cutoff } : week,
  );

  // Expired snapshots carry fetchedAt = epoch; they say nothing about when the data is from.
  const times = [...byKey.values()].map((s) => s.fetchedAt.getTime()).filter((t) => t > 0);
  return { stats, sources: included, fetchedAt: times.length ? new Date(Math.min(...times)) : null, fetchError };
}

/**
 * Make a week's snapshots stale so the next load refetches everything. They're kept (not deleted)
 * so the week still shows if GitHub can't be reached.
 */
export async function expireWeek(weekStart: string) {
  await db.update(snapshots).set({ fetchedAt: new Date(0) }).where(eq(snapshots.weekStart, weekStart));
}
