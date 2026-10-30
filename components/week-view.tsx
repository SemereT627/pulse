import Link from "next/link";
import { aiEnabled } from "@/lib/ai/summary";
import { deltas } from "@/lib/report/aggregate";
import { getReport } from "@/lib/report/generate";
import { toMarkdown } from "@/lib/report/markdown";
import { getRateLimit, getSettings, includedSources, loadWeek } from "@/lib/report/load";
import { addDays, previousWeek, weekContaining, weekFrom } from "@/lib/report/week";
import { fmtAgo, fmtIn, fmtRange } from "@/lib/format";
import { DayBars } from "./day-bars";
import { ExportButtons } from "./export-buttons";
import { RegenerateButton } from "./regenerate-button";
import { RepoList } from "./repo-list";
import { StatCards } from "./stat-cards";
import { SummaryCard } from "./summary-card";
import { WeekPicker } from "./week-picker";

/** `weekStart` omitted = the week in progress. */
export async function WeekView({ weekStart }: { weekStart?: string }) {
  const [settings, sources] = await Promise.all([getSettings(), includedSources()]);
  const now = new Date();
  const current = weekContaining(now, settings.timezone, settings.weekStartDay);
  const week = weekStart ? weekFrom(weekStart, settings.timezone) : current;
  const isCurrent = week.startDate === current.startDate;

  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <p className="text-lg font-medium">No repos selected yet</p>
        <p className="mt-2 text-sm text-muted">Pick the repos that count toward your week.</p>
        <Link
          href="/sources"
          className="mt-6 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Choose sources
        </Link>
      </div>
    );
  }

  // A week in progress is compared with last week up to the same point, not the whole of it.
  const prev = previousWeek(week);
  const cutoff = isCurrent ? new Date(prev.start.getTime() + (now.getTime() - week.start.getTime())) : undefined;
  const [thisWeek, lastWeek, rate, report] = await Promise.all([
    loadWeek(week, { sources }),
    loadWeek(prev, { sources, cutoff }),
    getRateLimit(),
    getReport(week.startDate),
  ]);
  const narrative = report?.narrative ?? null;
  const showSummary = aiEnabled() && settings.aiEnabled;
  const { stats } = thisWeek;
  const recentWeeks = Array.from({ length: 12 }, (_, i) => addDays(current.startDate, -7 * i));

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            {isCurrent ? (
              <span className="inline-flex items-center gap-2">
                <span className="size-1.5 animate-pulse rounded-full bg-accent" /> This week · in progress
              </span>
            ) : (
              "Week"
            )}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{fmtRange(week.startDate, week.endDate)}</h1>
          {thisWeek.fetchedAt && (
            <p className="font-mono text-xs text-muted">updated {fmtAgo(thisWeek.fetchedAt)}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WeekPicker weeks={recentWeeks} selected={week.startDate} current={current.startDate} />
          <RegenerateButton weekStart={week.startDate} />
          <ExportButtons
            markdown={toMarkdown(stats, week, { author: process.env.REPORT_NAME, narrative })}
            filename={`pulse-${week.startDate}_to_${week.endDate}.md`}
          />
        </div>
      </header>

      {showSummary && (
        <SummaryCard
          weekStart={week.startDate}
          narrative={narrative}
          hasActivity={stats.repos.length > 0}
          isCurrent={isCurrent}
        />
      )}

      <StatCards
        deltas={deltas(stats.totals, lastWeek.stats.totals)}
        medianHoursToMerge={stats.medianHoursToMerge}
        comparedTo={isCurrent ? "this time last week" : "last week"}
      />

      <section className="space-y-4">
        <SectionTitle>Activity by day</SectionTitle>
        <DayBars days={stats.byDay} />
      </section>

      <section className="space-y-4">
        <SectionTitle>
          Repos <span className="text-muted">· {stats.repos.length}</span>
        </SectionTitle>
        {stats.repos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            Nothing yet this week{isCurrent ? " — go ship something." : "."}
          </p>
        ) : (
          <RepoList repos={stats.repos} timezone={week.timezone} />
        )}
      </section>

      <footer className="flex flex-wrap justify-between gap-2 border-t border-border pt-6 font-mono text-xs text-muted">
        <span>
          {sources.length} repos tracked · <Link href="/sources" className="hover:text-foreground">edit</Link>
        </span>
        {rate && (
          <span>
            GitHub API {rate.remaining.toLocaleString()}/{rate.limit.toLocaleString()} · resets {fmtIn(rate.resetAt)}
          </span>
        )}
      </footer>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-mono text-xs uppercase tracking-[0.18em]">{children}</h2>;
}

export function WeekViewSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <div className="h-3 w-40 animate-pulse rounded bg-surface" />
        <div className="h-9 w-56 animate-pulse rounded bg-surface" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-surface" />
      <p className="font-mono text-xs text-muted">Fetching from GitHub…</p>
    </div>
  );
}
