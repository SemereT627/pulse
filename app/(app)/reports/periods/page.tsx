import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/ui";
import { aiReady, getAiKeys } from "@/lib/ai/providers";
import { savedReports } from "@/lib/report/generate";
import { getSettings } from "@/lib/report/load";
import { isPeriodKey, periodKey, periodLabel, PERIOD_KINDS, type PeriodKind } from "@/lib/report/periods";
import { fmtNumber, fmtRange } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { ReportTabs } from "../tabs";
import { PeriodSummary } from "./period-summary";

export const metadata: Metadata = { title: "Summaries" };

const KIND_LABEL: Record<PeriodKind, string> = { month: "Month", quarter: "Quarter", year: "Year" };

export default function PeriodsPage({ searchParams }: PageProps<"/reports/periods">) {
  return (
    <div className="space-y-6">
      <ReportTabs />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Periods searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Periods({ searchParams }: Pick<PageProps<"/reports/periods">, "searchParams">) {
  const user = await currentUser();
  const [params, rows, settings, keys] = await Promise.all([searchParams, savedReports(user), getSettings(user), getAiKeys(user.id)]);
  const kind = PERIOD_KINDS.find((k) => k === params.kind) ?? "month";

  if (rows.length === 0) {
    return (
      <EmptyState title="No saved weeks yet">
        Summaries are built from saved weekly reports. The automatic report saves each finished week, and writing a weekly
        summary saves it too.
      </EmptyState>
    );
  }

  // Newest period first; each period's weeks oldest first.
  const byPeriod = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = periodKey(r.weekStart, kind);
    byPeriod.set(key, [...(byPeriod.get(key) ?? []), r]);
  }
  const periods = [...byPeriod.keys()].reverse();
  const requested = typeof params.period === "string" && isPeriodKey(params.period, kind) ? params.period : null;
  const period = requested && byPeriod.has(requested) ? requested : periods[0];
  const weeks = byPeriod.get(period)!;
  const label = periodLabel(period);
  const sum = (pick: (t: (typeof rows)[number]["stats"]["totals"]) => number) => weeks.reduce((n, w) => n + pick(w.stats.totals), 0);
  const totals = [
    { label: "Commits", value: fmtNumber(sum((t) => t.commits)) },
    { label: "PRs merged", value: fmtNumber(sum((t) => t.prsMerged)) },
    { label: "Reviews", value: fmtNumber(sum((t) => t.reviews)) },
    { label: "Issues closed", value: fmtNumber(sum((t) => t.issuesClosed)) },
    { label: "Lines", value: `+${fmtNumber(sum((t) => t.additions))} −${fmtNumber(sum((t) => t.deletions))}` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Summary"
        title={label}
        description={`From ${weeks.length} saved ${weeks.length === 1 ? "week" : "weeks"}. A week counts toward the ${kind} it starts in.`}
      />

      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_KINDS.map((k) => (
          <Link
            key={k}
            href={`/reports/periods?kind=${k}`}
            aria-current={k === kind ? "page" : undefined}
            className={`h-8 rounded-md px-3 text-sm leading-8 transition-colors ${
              k === kind ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {KIND_LABEL[k]}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {periods.map((p) => (
          <Link
            key={p}
            href={`/reports/periods?kind=${kind}&period=${p}`}
            aria-current={p === period ? "page" : undefined}
            className={`h-8 rounded-md border px-3 font-mono text-xs leading-8 transition-colors ${
              p === period ? "border-border bg-surface text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {periodLabel(p)}
          </Link>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border px-4 py-3 sm:grid-cols-5">
        {totals.map((t) => (
          <div key={t.label}>
            <dt className="text-xs text-muted">{t.label}</dt>
            <dd className="font-mono text-sm tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>

      <PeriodSummary key={`${kind}:${period}`} kind={kind} period={period} label={label} aiOn={aiReady(settings, keys)} />

      <Panel title="Weeks">
        <ul className="-mx-2">
          {weeks.map((w) => (
            <li key={w.weekStart}>
              <Link
                href={`/reports?week=${w.weekStart}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-2"
              >
                <span className="font-mono text-xs">{fmtRange(w.weekStart, w.weekEnd)}</span>
                <span className="flex items-center gap-3 font-mono text-xs text-muted">
                  {w.narrative && <span className="size-1.5 rounded-full bg-accent" title="Has summary" />}
                  {w.stats.totals.commits}c · {w.stats.totals.prsMerged}pr
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
