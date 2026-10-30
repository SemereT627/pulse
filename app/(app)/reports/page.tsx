import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { ExportButtons } from "@/components/export-buttons";
import { SummaryCard } from "@/components/summary-card";
import { EmptyState, LiveDot, PageHeader, Panel, Skeleton } from "@/components/ui";
import { aiReady } from "@/lib/ai/providers";
import { getReport, markdownOptions } from "@/lib/report/generate";
import { loadWeek } from "@/lib/report/load";
import { toMarkdown } from "@/lib/report/markdown";
import { selectedWeek, type WeekSearchParams } from "@/lib/report/selected";
import { weekQuery } from "@/lib/report/week";
import { fmtRange } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <Report searchParams={searchParams} />
    </Suspense>
  );
}

async function Report({ searchParams }: { searchParams: WeekSearchParams }) {
  const { settings, current, week, isCurrent } = await selectedWeek(searchParams);
  const [{ stats, sources }, report] = await Promise.all([loadWeek(week), getReport(week.startDate)]);
  const narrative = report?.narrative ?? null;
  const markdown = toMarkdown(stats, week, markdownOptions(settings, narrative));
  const aiOn = aiReady(settings);
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
              ? `Saved ${savedAt} by ${report!.trigger === "cron" ? "the Friday cron" : "you"}${report!.narrativeModel ? ` · summary by ${report!.narrativeModel}` : ""}`
              : "Not saved yet. The Friday cron saves each finished week; writing a summary saves it too."
          }
          actions={
            <ExportButtons markdown={markdown} filename={`pulse-${week.startDate}_to_${week.endDate}.md`} />
          }
        />

        {sources.length === 0 ? (
          <EmptyState title="No repos tracked yet">Choose repositories first, then come back for the report.</EmptyState>
        ) : (
          <>
            {aiOn ? (
              <SummaryCard
                weekStart={week.startDate}
                narrative={narrative}
                hasActivity={stats.repos.length > 0}
                isCurrent={isCurrent}
              />
            ) : (
              <Panel>
                <p className="text-sm text-muted">
                  {settings.aiEnabled ? "The AI provider has no API key yet." : "AI summaries are off."}{" "}
                  <Link href="/settings#ai" className="text-foreground underline underline-offset-4 hover:text-accent">
                    Set them up in Settings
                  </Link>{" "}
                  to get a first-person update for your manager; the Markdown below has the stats either way.
                </p>
              </Panel>
            )}

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
          <Archive selected={week.startDate} current={current.startDate} />
        </Suspense>
      </aside>
    </div>
  );
}

async function Archive({ selected, current }: { selected: string; current: string }) {
  const rows = await db
    .select({
      weekStart: reports.weekStart,
      weekEnd: reports.weekEnd,
      trigger: reports.trigger,
      hasNarrative: sql<boolean>`${reports.narrative} is not null`,
    })
    .from(reports)
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
