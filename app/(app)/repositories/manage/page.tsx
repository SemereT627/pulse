import { Suspense } from "react";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { EmptyState, PageHeader, Skeleton, primaryButtonClass } from "@/components/ui";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github/app";
import { syncIfEmpty, syncSources } from "@/lib/github/repos";
import { currentUser } from "@/lib/session";
import { RepoTabs } from "../tabs";
import { SourcesList } from "./sources-list";
import { SyncButton } from "./sync-button";

export const metadata: Metadata = { title: "Tracked repos" };

export default function ManageReposPage({ searchParams }: PageProps<"/repositories/manage">) {
  return (
    <div className="space-y-6">
      <RepoTabs />
      <PageHeader
        title="Tracked repos"
        description="Pick the repos that count. Commits on the default branch plus the extra branches listed are included."
        actions={<SyncButton />}
      />
      <Suspense fallback={<ListSkeleton />}>
        <Sources searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Sources({ searchParams }: Pick<PageProps<"/repositories/manage">, "searchParams">) {
  const [user, params] = await Promise.all([currentUser(), searchParams]);
  // GitHub sends people here (the app's Setup URL) after they install or change the app: pick up the new repos.
  if (params.setup_action) await syncSources(user).catch((e) => console.error("post-install sync failed", e));
  else await syncIfEmpty(user);
  const rows = await db.select().from(sources).where(eq(sources.userId, user.id)).orderBy(desc(sources.pushedAt));
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No repos yet"
        action={
          <a href={GITHUB_APP_INSTALL_URL} className={primaryButtonClass}>
            Install Pulse Weekly on GitHub
          </a>
        }
      >
        Pulse sees the repos where its GitHub app is installed. Install it on your account and any organizations whose
        repos should count, then come back here.
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
  return (
    <p className="text-sm text-muted">
      Missing repos? Pulse only sees repos where its GitHub app is installed:{" "}
      <a href={GITHUB_APP_INSTALL_URL} className="underline hover:text-foreground">
        install or configure Pulse Weekly
      </a>{" "}
      on your account or organization (organization owners approve installs there). Or add a personal access token in{" "}
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
