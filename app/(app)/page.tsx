import { Suspense } from "react";
import Link from "next/link";
import { DayBars } from "@/components/day-bars";
import { SparkIcon } from "@/components/icons";
import { RegenerateButton } from "@/components/regenerate-button";
import { StatCards } from "@/components/stat-cards";
import { WeekTrend } from "@/components/week-trend";
import { EmptyState, LiveDot, PageHeader, Panel, PanelLink, Skeleton, primaryButtonClass } from "@/components/ui";
import { aiReady } from "@/lib/ai/providers";
import { deltas } from "@/lib/report/aggregate";
import { getReport } from "@/lib/report/generate";
import { includedSources, loadWeek } from "@/lib/report/load";
import { selectedWeek } from "@/lib/report/selected";
import { addDays, previousWeek, weekFrom, weekQuery, type WeekWindow } from "@/lib/report/week";
import type { RepoActivity } from "@/lib/report/types";
import { fmtAgo, fmtNumber, fmtRange } from "@/lib/format";

const TREND_WEEKS = 8;

export default function OverviewPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

async function Overview({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const [{ settings, now, current, week, isCurrent }, sources] = await Promise.all([
    selectedWeek(searchParams),
    includedSources(),
  ]);

  if (sources.length === 0) {
    return (
      <EmptyState
        title="No repos tracked yet"
        action={
          <Link href="/repositories/manage" className={primaryButtonClass}>
            Choose repositories
          </Link>
        }
      >
        Pick the repos that count toward your week, and Pulse will pull your commits, PRs and reviews from them.
      </EmptyState>
    );
  }

  // A week in progress is compared with last week up to the same point, not the whole of it.
  const prev = previousWeek(week);
  const cutoff = isCurrent ? new Date(prev.start.getTime() + (now.getTime() - week.start.getTime())) : undefined;
  const [thisWeek, lastWeek, report] = await Promise.all([
    loadWeek(week, { sources }),
    loadWeek(prev, { sources, cutoff }),
    getReport(week.startDate),
  ]);
  const { stats } = thisWeek;
  const q = weekQuery(week.startDate, current.startDate);
  const trendWeeks = Array.from({ length: TREND_WEEKS }, (_, i) =>
    weekFrom(addDays(week.startDate, -7 * (TREND_WEEKS - 1 - i)), settings.timezone),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          isCurrent ? (
            <span className="inline-flex items-center gap-2">
              <LiveDot /> This week · in progress
            </span>
          ) : (
            "Week"
          )
        }
        title={fmtRange(week.startDate, week.endDate)}
        description={thisWeek.fetchedAt ? `Synced from GitHub ${fmtAgo(thisWeek.fetchedAt, now.getTime())}` : undefined}
        actions={<RegenerateButton weekStart={week.startDate} />}
      />

      <StatCards
        deltas={deltas(stats.totals, lastWeek.stats.totals)}
        medianHoursToMerge={stats.medianHoursToMerge}
        comparedTo={isCurrent ? "this time last week" : "last week"}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Activity by day" className="lg:col-span-2">
          <DayBars days={stats.byDay} />
        </Panel>
        <SummaryPreview
          narrative={report?.narrative ?? null}
          href={`/reports${q}`}
          aiOn={aiReady(settings)}
          hasActivity={stats.repos.length > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Top repositories" action={<PanelLink href={`/repositories${q}`}>All</PanelLink>}>
          <TopRepos repos={stats.repos} />
        </Panel>
        <Panel title="Pull requests" action={<PanelLink href={`/repositories${q}`}>Details</PanelLink>}>
          <RecentPrs repos={stats.repos} />
        </Panel>
      </div>

      <Panel title={`Last ${TREND_WEEKS} weeks`} action="commits and PRs merged per week">
        <Suspense fallback={<Skeleton className="h-44 bg-surface-2" />}>
          <Trend weeks={trendWeeks} current={current.startDate} selected={week.startDate} />
        </Suspense>
      </Panel>
    </div>
  );
}

async function Trend({ weeks, current, selected }: { weeks: WeekWindow[]; current: string; selected: string }) {
  // Past weeks are cached snapshots after their first load, so this is cheap on repeat visits.
  const loaded = await Promise.all(weeks.map((w) => loadWeek(w)));
  return (
    <WeekTrend
      weeks={weeks.map((w, i) => ({
        start: w.startDate,
        end: w.endDate,
        commits: loaded[i].stats.totals.commits,
        prsMerged: loaded[i].stats.totals.prsMerged,
        isCurrent: w.startDate === current,
        isSelected: w.startDate === selected,
        href: `/${weekQuery(w.startDate, current)}`,
      }))}
    />
  );
}

function SummaryPreview({
  narrative,
  href,
  aiOn,
  hasActivity,
}: {
  narrative: string | null;
  href: string;
  aiOn: boolean;
  hasActivity: boolean;
}) {
  const first = narrative?.split(/\n{2,}/)[0];
  return (
    <Panel title="Weekly update" action={<PanelLink href={href}>Open report</PanelLink>}>
      {first ? (
        <p className="line-clamp-[9] text-sm leading-relaxed">{first}</p>
      ) : (
        <div className="flex h-full flex-col items-start gap-4">
          <SparkIcon className="size-6 text-accent" />
          <p className="text-sm text-muted">
            {!hasActivity
              ? "Nothing to write up yet."
              : aiOn
                ? "No summary for this week yet. Write one from your PRs and commits on the report page."
                : "AI summaries aren't set up. Pick a provider in Settings, or export the stats as Markdown from the report."}
          </p>
          {hasActivity && (
            <Link href={href} className={primaryButtonClass}>
              Go to report
            </Link>
          )}
        </div>
      )}
    </Panel>
  );
}

function TopRepos({ repos }: { repos: RepoActivity[] }) {
  if (repos.length === 0) return <p className="py-6 text-center text-sm text-muted">No activity this week.</p>;
  const top = repos.slice(0, 5);
  const max = Math.max(1, ...top.map((r) => r.commits.length));
  return (
    <ul className="space-y-3.5">
      {top.map((r) => {
        const [owner, name] = r.repo.split("/");
        return (
          <li key={r.repo} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                <span className="text-muted">{owner}/</span>
                {name}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted">
                {r.commits.length}c · {r.prs.length}pr · {r.reviews.length}rv
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <div className="h-full rounded-full bg-accent/80" style={{ width: `${(r.commits.length / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
      {repos.length > top.length && (
        <li className="font-mono text-xs text-muted">+{repos.length - top.length} more active</li>
      )}
    </ul>
  );
}

const STATUS_DOT = { merged: "bg-accent", open: "bg-foreground", draft: "bg-muted", closed: "bg-danger" } as const;

function RecentPrs({ repos }: { repos: RepoActivity[] }) {
  const prs = repos
    .flatMap((r) => r.prs.map((pr) => ({ ...pr, repoName: r.repo.split("/")[1] })))
    .sort((a, b) => (b.mergedAt ?? b.createdAt).localeCompare(a.mergedAt ?? a.createdAt));
  if (prs.length === 0) return <p className="py-6 text-center text-sm text-muted">No pull requests this week.</p>;
  return (
    <ul className="-mx-2 space-y-0.5">
      {prs.slice(0, 7).map((pr) => (
        <li key={pr.url}>
          <a
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-2"
          >
            <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[pr.status]}`} title={pr.status} />
            <span className="min-w-0 flex-1 truncate">{pr.title}</span>
            <span className="shrink-0 font-mono text-xs text-muted">
              {pr.repoName}#{pr.number}
            </span>
          </a>
        </li>
      ))}
      {prs.length > 7 && <li className="px-2 pt-1 font-mono text-xs text-muted">+{fmtNumber(prs.length - 7)} more</li>}
    </ul>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
      <p className="font-mono text-xs text-muted">Fetching from GitHub…</p>
    </div>
  );
}
