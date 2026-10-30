import { Suspense } from "react";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { Nav } from "@/components/nav";
import { SourcesList } from "./sources-list";
import { SyncButton } from "./sync-button";

export default function SourcesPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16">
        <div className="flex items-end justify-between gap-4 py-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
            <p className="text-sm text-muted">
              Pick the repos that count. Commits on the default branch plus the extra branches listed are included.
            </p>
          </div>
          <SyncButton />
        </div>
        <Suspense fallback={<ListSkeleton />}>
          <Sources />
        </Suspense>
      </main>
    </>
  );
}

async function Sources() {
  const rows = await db.select().from(sources).orderBy(desc(sources.pushedAt));
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
        No repos yet. Hit <span className="font-mono">Sync from GitHub</span> to load everything your token can see.
      </p>
    );
  }
  return <SourcesList rows={rows} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" />
      ))}
    </div>
  );
}
