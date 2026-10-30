import { Suspense } from "react";
import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { RepoTabs } from "../tabs";
import { SourcesList } from "./sources-list";
import { SyncButton } from "./sync-button";

export const metadata: Metadata = { title: "Tracked repos" };

export default function ManageReposPage() {
  return (
    <div className="space-y-6">
      <RepoTabs />
      <PageHeader
        title="Tracked repos"
        description="Pick the repos that count. Commits on the default branch plus the extra branches listed are included."
        actions={<SyncButton />}
      />
      <Suspense fallback={<ListSkeleton />}>
        <Sources />
      </Suspense>
    </div>
  );
}

async function Sources() {
  const rows = await db.select().from(sources).orderBy(desc(sources.pushedAt));
  if (rows.length === 0) {
    return (
      <EmptyState title="No repos yet">
        Hit <span className="font-mono">Sync from GitHub</span> to load everything your token can see.
      </EmptyState>
    );
  }
  return <SourcesList rows={rows} />;
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}
