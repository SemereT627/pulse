import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { ExportButtons } from "@/components/export-buttons";
import { SummaryCard } from "@/components/summary-card";
import { EmptyState, LiveDot, OfflineNotice, PageHeader, Panel, Skeleton } from "@/components/ui";
import { aiReady, getAiKeys } from "@/lib/ai/providers";
import { getReport, isEdited, markdownOptions } from "@/lib/report/generate";
import { loadWeek } from "@/lib/report/load";
import { toMarkdown } from "@/lib/report/markdown";
import { selectedWeek, type WeekSearchParams } from "@/lib/report/selected";
import { weekQuery } from "@/lib/report/week";
import { fmtRange } from "@/lib/format";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <Report searchParams={searchParams} />
    </Suspense>
  );
}

async function Report({ searchParams }: { searchParams: WeekSearchParams }) {
  const user = await currentUser();
  const { settings, now, current, week, isCurrent } = await selectedWeek(user, searchParams);
  const [{ stats, sources, fetchedAt, fetchError }, report, keys] = await Promise.all([
    loadWeek(user, week),
    getReport(user, week.startDate),
    getAiKeys(user.id),
  ]);
  const narrative = report?.narrative ?? null;
  const markdown = toMarkdown(stats, week, markdownOptions(user, settings, narrative));
  const aiOn = aiReady(settings, keys);
  const savedAt = report
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: settings.timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(report.generatedAt)
    : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0 space-y-6">
        <PageHeader
          eyebrow={
            isCurrent ? (
              <span className="inline-flex items-center gap-2">
                <LiveDot /> Draft · week in progress
              </span>
            ) : (
              "Weekly report"
            )
          }
          title={fmtRange(week.startDate, week.endDate)}
          description={
            savedAt
              ? `Saved ${savedAt} by ${report!.trigger === "cron" ? "the automatic report" : "you"}${report!.narrativeModel ? ` · summary: ${report!.narrativeModel}` : ""}`
              : "Not saved yet. The automatic report saves each finished week on your report day; writing a summary saves it too."
          }
          actions={
            <ExportButtons markdown={markdown} filename={`pulse-${week.startDate}_to_${week.endDate}.md`} />
          }
        />

        {fetchError && <OfflineNotice fetchedAt={fetchedAt} now={now} />}

        {sources.length === 0 ? (
          <EmptyState title="No repos tracked yet">Choose repositories first, then come back for the report.</EmptyState>
        ) : (
          <>
            <SummaryCard
              weekStart={week.startDate}
              narrative={narrative}
              hasActivity={stats.repos.length > 0}
              isCurrent={isCurrent}
              aiOn={aiOn}
              edited={isEdited(report?.narrativeModel ?? null)}
            />

            <Panel title="Markdown" action={`${markdown.split("\n").length} lines`}>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted">
                {markdown}
              </pre>
            </Panel>
          </>
        )}
      </div>

      <aside className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Archive</h2>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Archive userId={user.id} selected={week.startDate} current={current.startDate} />
        </Suspense>
      </aside>
    </div>
  );
}

async function Archive({ userId, selected, current }: { userId: number; selected: string; current: string }) {
  const rows = await db
    .select({
      weekStart: reports.weekStart,
      weekEnd: reports.weekEnd,
      trigger: reports.trigger,
      hasNarrative: sql<boolean>`${reports.narrative} is not null`,
    })
    .from(reports)
    .where(eq(reports.userId, userId))
    .orderBy(desc(reports.weekStart))
    .limit(52);

  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">Saved reports show up here.</p>;
  }

  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const active = r.weekStart === selected;
        return (
          <li key={r.weekStart}>
            <Link
              href={`/reports${weekQuery(r.weekStart, current)}`}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                active ? "border-border bg-surface" : "border-transparent text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              <span className="font-mono text-xs">{fmtRange(r.weekStart, r.weekEnd)}</span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-muted">
                {r.hasNarrative && <span className="size-1.5 rounded-full bg-accent" title="Has summary" />}
                {r.trigger}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-56" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-72" />
    </div>
  );
}
