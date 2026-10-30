"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fmtDay, fmtRange } from "@/lib/format";

type TrendWeek = {
  start: string;
  end: string;
  commits: number;
  prsMerged: number;
  isCurrent: boolean;
  isSelected: boolean;
  href: string;
};

export function WeekTrend({ weeks }: { weeks: TrendWeek[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.commits));

  return (
    <div>
      <div className="grid h-36 items-end gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((w, i) => (
          <Link
            key={w.start}
            href={w.href}
            aria-label={`${fmtRange(w.start, w.end)}: ${w.commits} commits, ${w.prsMerged} PRs merged`}
            aria-current={w.isSelected ? "true" : undefined}
            className="group flex h-full flex-col items-center justify-end gap-1.5"
          >
            <span className={`font-mono text-xs tabular-nums ${w.isSelected ? "text-foreground" : "text-muted"}`}>
              {w.commits || ""}
            </span>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(w.commits / max) * 100}%` }}
              transition={{ delay: 0.05 + i * 0.04, duration: 0.4, ease: "easeOut" }}
              className={`w-full max-w-12 rounded-t transition-colors ${
                w.isSelected ? "bg-accent" : "bg-accent/35 group-hover:bg-accent/60"
              } ${w.isCurrent ? "bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(0_0_0/0.18)_4px_6px)]" : ""}`}
              style={{ minHeight: w.commits ? 4 : 0 }}
            />
            <div className="h-px w-full bg-border" />
          </Link>
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((w) => (
          <div key={w.start} className="flex flex-col items-center gap-0.5">
            <span className={`font-mono text-[11px] ${w.isSelected ? "text-foreground" : "text-muted"}`}>
              {w.isCurrent ? "now" : fmtDay(w.start, { month: "short", day: "numeric" })}
            </span>
            <span className="font-mono text-[11px] text-muted" title="PRs merged">
              {w.prsMerged ? `${w.prsMerged} pr` : "·"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
