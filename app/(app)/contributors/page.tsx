import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { RegenerateButton } from "@/components/regenerate-button";
import { EmptyState, OfflineNotice, PageHeader, Panel, Skeleton } from "@/components/ui";
import { collaborators, hasCollaboratorData, type CollabLink, type Collaborator } from "@/lib/report/collaborators";
import { loadWeek } from "@/lib/report/load";
import { selectedWeek, type WeekSearchParams } from "@/lib/report/selected";
import { fmtRange } from "@/lib/format";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Contributors" };

export default function ContributorsPage({ searchParams }: PageProps<"/contributors">) {
  return (
    <Suspense fallback={<PeopleSkeleton />}>
      <People searchParams={searchParams} />
    </Suspense>
  );
}

async function People({ searchParams }: { searchParams: WeekSearchParams }) {
  const user = await currentUser();
  const { week, isCurrent, now } = await selectedWeek(user, searchParams);
  const { stats, fetchedAt, fetchError } = await loadWeek(user, week);
  const people = collaborators(stats.repos);
  const complete = hasCollaboratorData(stats.repos);
  const reviewedMine = people.filter((p) => p.reviewedMine.length > 0).length;
  const iReviewed = people.filter((p) => p.iReviewed.length > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isCurrent ? "This week" : "Week"}
        title={fmtRange(week.startDate, week.endDate)}
        description="People you worked with: who reviewed your pull requests, and whose pull requests you reviewed. Bots are left out."
        actions={!complete && <RegenerateButton weekStart={week.startDate} />}
      />

      {fetchError && <OfflineNotice fetchedAt={fetchedAt} now={now} />}

      {!complete && !fetchError && (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          This week was fetched before Pulse tracked reviewers, so some people may be missing. Refresh to refetch it.
        </p>
      )}

      {people.length === 0 ? (
        <EmptyState title="No collaborators this week">
          Nobody reviewed your PRs and you didn&apos;t review anyone&apos;s in tracked repos{isCurrent ? " yet." : "."}
        </EmptyState>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {[
              { label: "People", value: people.length },
              { label: "Reviewed your PRs", value: reviewedMine },
              { label: "You reviewed", value: iReviewed },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
                <dt className="text-xs text-muted">{s.label}</dt>
                <dd className="mt-2 font-mono text-2xl font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="grid gap-4 md:grid-cols-2">
            {people.map((p) => (
              <li key={p.login}>
                <PersonCard person={p} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function PersonCard({ person: p }: { person: Collaborator }) {
  return (
    <Panel className="h-full">
      <div className="flex items-center gap-3">
        <Image
          src={`https://avatars.githubusercontent.com/${encodeURIComponent(p.login)}?s=80`}
          alt=""
          width={40}
          height={40}
          className="size-10 rounded-full border border-border"
        />
        <div className="min-w-0">
          <a
            href={`https://github.com/${p.login}`}
            target="_blank"
            rel="noreferrer"
            className="truncate font-medium hover:text-accent"
          >
            {p.login}
          </a>
          <p className="truncate font-mono text-xs text-muted">{p.repos.map((r) => r.split("/")[1]).join(" · ")}</p>
        </div>
        <p className="ml-auto shrink-0 font-mono text-xs text-muted" aria-label="Interactions">
          {p.reviewedMine.length + p.iReviewed.length}
        </p>
      </div>
      <div className="mt-4 space-y-3">
        <Links title="Reviewed your PRs" links={p.reviewedMine} />
        <Links title="You reviewed" links={p.iReviewed} />
      </div>
    </Panel>
  );
}

function Links({ title, links }: { title: string; links: CollabLink[] }) {
  if (links.length === 0) return null;
  return (
    <div>
      <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        {title} · {links.length}
      </p>
      <ul className="-mx-2">
        {links.map((l) => (
          <li key={l.url}>
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-surface-2"
            >
              <span className="shrink-0 font-mono text-xs text-muted">#{l.number}</span>
              <span className="min-w-0 truncate">{l.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PeopleSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
