"use client";

import { motion } from "framer-motion";
import { fmtDay } from "@/lib/format";
import type { WeekStats } from "@/lib/report/types";

export function DayBars({ days }: { days: WeekStats["byDay"] }) {
  const max = Math.max(1, ...days.map((d) => d.commits));

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="grid h-36 grid-cols-7 items-end gap-2 sm:gap-4">
        {days.map((d, i) => (
          <div key={d.date} className="flex h-full flex-col items-center justify-end gap-1.5">
            <span className="font-mono text-xs tabular-nums text-muted">{d.commits || ""}</span>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(d.commits / max) * 100}%` }}
              transition={{ delay: 0.1 + i * 0.04, duration: 0.4, ease: "easeOut" }}
              className="w-full max-w-10 rounded-t bg-accent/80"
              style={{ minHeight: d.commits ? 4 : 0 }}
              title={`${d.commits} commits`}
            />
            <div className="h-px w-full bg-border" />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2 sm:gap-4">
        {days.map((d) => (
          <div key={d.date} className="flex flex-col items-center gap-1">
            <span className="font-mono text-[11px] uppercase text-muted">{fmtDay(d.date, { weekday: "short" })}</span>
            <span className="flex h-3 items-center gap-1" aria-label={`${d.prs} PRs merged, ${d.reviews} reviews`}>
              {Array.from({ length: Math.min(d.prs, 4) }, (_, j) => (
                <span key={`p${j}`} className="size-1.5 rounded-full bg-foreground" />
              ))}
              {Array.from({ length: Math.min(d.reviews, 4) }, (_, j) => (
                <span key={`r${j}`} className="size-1.5 rounded-full border border-muted" />
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 flex gap-4 font-mono text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-accent/80" /> commits
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-foreground" /> PR merged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full border border-muted" /> review
        </span>
      </p>
    </div>
  );
}
