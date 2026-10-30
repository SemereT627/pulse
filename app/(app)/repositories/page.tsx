import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { RepoList } from "@/components/repo-list";
import { EmptyState, PageHeader, Skeleton, primaryButtonClass } from "@/components/ui";
import { loadWeek } from "@/lib/report/load";
import { selectedWeek, type WeekSearchParams } from "@/lib/report/selected";
import { fmtNumber, fmtRange } from "@/lib/format";
import { RepoTabs } from "./tabs";

export const metadata: Metadata = { title: "Repositories" };

export default function RepositoriesPage({ searchParams }: PageProps<"/repositories">) {
  return (
    <div className="space-y-6">
      <RepoTabs />
      <Suspense fallback={<RepoSkeleton />}>
        <Activity searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Activity({ searchParams }: { searchParams: WeekSearchParams }) {
  const { week, isCurrent } = await selectedWeek(searchParams);
  const { stats, sources } = await loadWeek(week);

  if (sources.length === 0) {
    return (
      <EmptyState
        title="No repos tracked yet"
        action={
          <Link href="/repositories/manage" className={primaryButtonClass}>
            Choose repositories
          </Link>
        }
      />
    );
  }

  const active = new Set(stats.repos.map((r) => r.repo));
  const quiet = sources.map((s) => `${s.owner}/${s.name}`).filter((r) => !active.has(r)).sort();
  const { totals } = stats;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isCurrent ? "This week" : "Week"}
        title={fmtRange(week.startDate, week.endDate)}
        description={`${stats.repos.length} of ${sources.length} tracked repos active · ${fmtNumber(totals.commits)} commits · ${fmtNumber(totals.prsOpened + totals.prsMerged)} PR events · ${fmtNumber(totals.reviews)} reviews`}
      />

      {stats.repos.length === 0 ? (
        <EmptyState title="Quiet week">No commits, PRs or reviews in tracked repos{isCurrent ? " yet." : "."}</EmptyState>
      ) : (
        <RepoList repos={stats.repos} timezone={week.timezone} />
      )}

      {quiet.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-muted">No activity · {quiet.length}</h2>
          <ul className="flex flex-wrap gap-2">
            {quiet.map((r) => (
              <li key={r} className="rounded-md border border-border px-2 py-1 font-mono text-xs text-muted">
                {r}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RepoSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-56" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}
