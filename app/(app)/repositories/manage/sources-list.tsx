"use client";

import { useOptimistic, useTransition } from "react";
import type { Source } from "@/db/schema";
import { setBranchesAction, setIncludedAction } from "./actions";

export function SourcesList({ rows }: { rows: Source[] }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(rows, (state, change: { ids: number[]; included: boolean }) =>
    state.map((r) => (change.ids.includes(r.id) ? { ...r, included: change.included } : r)),
  );

  const toggle = (ids: number[], included: boolean) =>
    startTransition(async () => {
      setOptimistic({ ids, included });
      await setIncludedAction(ids, included);
    });

  // Rows arrive sorted by pushedAt desc, so owners come out ordered by most recent activity.
  const byOwner = new Map<string, Source[]>();
  for (const r of optimistic) byOwner.set(r.owner, [...(byOwner.get(r.owner) ?? []), r]);
  const includedCount = optimistic.filter((r) => r.included).length;

  return (
    <div className="space-y-8">
      <p className="font-mono text-xs text-muted">
        {includedCount} of {optimistic.length} repos included
      </p>

      {[...byOwner].map(([owner, repos]) => (
        <section key={owner} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm">{owner}</h2>
            <div className="flex gap-3 font-mono text-xs text-muted">
              <button type="button" className="hover:text-foreground" onClick={() => toggle(repos.map((r) => r.id), true)}>
                all
              </button>
              <button type="button" className="hover:text-foreground" onClick={() => toggle(repos.map((r) => r.id), false)}>
                none
              </button>
            </div>
          </div>

          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {repos.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex min-w-0 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={r.included}
                    onChange={(e) => toggle([r.id], e.target.checked)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  <span className={`truncate text-sm ${r.isArchived ? "text-muted line-through" : ""}`}>{r.name}</span>
                  {r.isPrivate && <span className="font-mono text-[10px] uppercase text-muted">private</span>}
                </label>

                {r.included && (
                  <div className="flex items-center gap-2 pl-7 font-mono text-xs text-muted sm:pl-0">
                    <span>{r.defaultBranch ?? "—"} +</span>
                    <input
                      defaultValue={r.extraBranches.join(", ")}
                      placeholder="dev"
                      aria-label={`Extra branches for ${r.name}`}
                      onBlur={(e) => {
                        if (e.target.value !== r.extraBranches.join(", ")) setBranchesAction(r.id, e.target.value);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      className="w-32 rounded border border-border bg-background px-2 py-1 text-foreground outline-none focus:border-muted"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
