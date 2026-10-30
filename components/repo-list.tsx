"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PrStatus, RepoActivity } from "@/lib/report/types";
import { fmtHours, fmtNumber, fmtTime } from "@/lib/format";

export function RepoList({ repos, timezone }: { repos: RepoActivity[]; timezone: string }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(repos.slice(0, 1).map((r) => r.repo)));
  const toggle = (repo: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(repo)) next.delete(repo);
      else next.add(repo);
      return next;
    });

  return (
    <div className="space-y-3">
      {repos.map((r) => (
        <RepoCard key={r.repo} repo={r} open={open.has(r.repo)} onToggle={() => toggle(r.repo)} timezone={timezone} />
      ))}
    </div>
  );
}

function RepoCard({
  repo: r,
  open,
  onToggle,
  timezone,
}: {
  repo: RepoActivity;
  open: boolean;
  onToggle: () => void;
  timezone: string;
}) {
  const [owner, name] = r.repo.split("/");
  const counts = [
    r.commits.length && `${r.commits.length} commit${r.commits.length === 1 ? "" : "s"}`,
    r.prs.length && `${r.prs.length} PR${r.prs.length === 1 ? "" : "s"}`,
    r.reviews.length && `${r.reviews.length} review${r.reviews.length === 1 ? "" : "s"}`,
    r.releases.length && `${r.releases.length} release${r.releases.length === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-background/40"
      >
        <div className="min-w-0">
          <p className="truncate text-sm">
            <span className="text-muted">{owner}/</span>
            <span className="font-medium">{name}</span>
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {counts.join(" · ")}
            {r.additions + r.deletions > 0 && (
              <>
                {" · "}
                <span className="text-accent">+{fmtNumber(r.additions)}</span>{" "}
                <span className="text-danger">−{fmtNumber(r.deletions)}</span>
              </>
            )}
          </p>
        </div>
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="shrink-0 font-mono text-muted">
          ›
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="space-y-5 border-t border-border px-4 py-4">
              {r.prs.length > 0 && (
                <Group title="Pull requests">
                  {r.prs.map((pr) => (
                    <Row key={pr.number} href={pr.url}>
                      <StatusPill status={pr.status} />
                      <span className="font-mono text-xs text-muted">#{pr.number}</span>
                      <span className="min-w-0 flex-1 truncate">{pr.title}</span>
                      {pr.hoursToMerge !== null && (
                        <span className="shrink-0 font-mono text-xs text-muted">{fmtHours(pr.hoursToMerge)}</span>
                      )}
                    </Row>
                  ))}
                </Group>
              )}

              {r.commits.length > 0 && (
                <Group title="Commits">
                  {r.commits.map((c) => (
                    <Row key={c.oid} href={c.url}>
                      <span className="shrink-0 font-mono text-xs text-accent">{c.oid.slice(0, 7)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.message}</span>
                      <span className="hidden shrink-0 font-mono text-xs text-muted sm:inline">
                        {fmtTime(c.committedDate, timezone)}
                      </span>
                    </Row>
                  ))}
                </Group>
              )}

              {r.reviews.length > 0 && (
                <Group title="Reviews given">
                  {r.reviews.map((rv) => (
                    <Row key={`${rv.prNumber}-${rv.occurredAt}`} href={rv.prUrl}>
                      <span className="shrink-0 font-mono text-[10px] uppercase text-muted">{rv.state.toLowerCase().replace("_", " ")}</span>
                      <span className="font-mono text-xs text-muted">#{rv.prNumber}</span>
                      <span className="min-w-0 flex-1 truncate">{rv.prTitle}</span>
                    </Row>
                  ))}
                </Group>
              )}

              {r.releases.length > 0 && (
                <Group title="Releases">
                  {r.releases.map((rel) => (
                    <Row key={rel.tagName} href={rel.url}>
                      <span className="font-mono text-xs text-accent">{rel.tagName}</span>
                      <span className="min-w-0 flex-1 truncate">{rel.name}</span>
                    </Row>
                  ))}
                </Group>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">{title}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="-mx-2 flex items-center gap-3 rounded px-2 py-1.5 text-sm transition-colors hover:bg-background/60"
      >
        {children}
      </a>
    </li>
  );
}

const PILL: Record<PrStatus, string> = {
  merged: "border-accent/40 text-accent",
  open: "border-foreground/30 text-foreground",
  draft: "border-border text-muted",
  closed: "border-danger/40 text-danger",
};

function StatusPill({ status }: { status: PrStatus }) {
  return (
    <span className={`w-14 shrink-0 rounded border px-1.5 py-0.5 text-center font-mono text-[10px] uppercase ${PILL[status]}`}>
      {status}
    </span>
  );
}
