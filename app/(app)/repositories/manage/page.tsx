import { Suspense } from "react";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { syncIfEmpty } from "@/lib/github/repos";
import { currentUser } from "@/lib/session";
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
  const user = await currentUser();
  await syncIfEmpty(user);
  const rows = await db.select().from(sources).where(eq(sources.userId, user.id)).orderBy(desc(sources.pushedAt));
  if (rows.length === 0) {
    return (
      <EmptyState title="No repos yet">
        Hit <span className="font-mono">Sync from GitHub</span> to load every repo your GitHub account can see.
      </EmptyState>
    );
  }
  return (
    <>
      <SourcesList rows={rows} />
      <OrgNote />
    </>
  );
}

function OrgNote() {
  const settingsUrl = `https://github.com/settings/connections/applications/${process.env.AUTH_GITHUB_ID}`;
  return (
    <p className="text-sm text-muted">
      Missing your company&apos;s repos? Your organization may need to approve Pulse:{" "}
      <a href={settingsUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
        request access on GitHub
      </a>
      , or add a personal access token in{" "}
      <a href="/settings" className="underline hover:text-foreground">
        Settings
      </a>
      .
    </p>
  );
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
