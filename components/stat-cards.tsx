"use client";

import { motion } from "framer-motion";
import type { Delta } from "@/lib/report/aggregate";
import type { Totals } from "@/lib/report/types";
import { fmtHours, fmtNumber } from "@/lib/format";

type Props = { deltas: Record<keyof Totals, Delta>; medianHoursToMerge: number | null; comparedTo: string };

export function StatCards({ deltas: d, medianHoursToMerge, comparedTo }: Props) {
  const primary = [
    { label: "Commits", delta: d.commits },
    { label: "PRs merged", delta: d.prsMerged },
    { label: "Reviews", delta: d.reviews },
    { label: "Active days", delta: d.activeDays, suffix: "/7" },
  ];
  const secondary = [
    { label: "PRs opened", value: fmtNumber(d.prsOpened.value) },
    { label: "Issues closed", value: fmtNumber(d.issuesClosed.value) },
    { label: "Releases", value: fmtNumber(d.releases.value) },
    { label: "Median merge", value: fmtHours(medianHoursToMerge) },
    {
      label: "Lines",
      value: (
        <>
          <span className="text-accent">+{fmtNumber(d.additions.value)}</span>{" "}
          <span className="text-danger">−{fmtNumber(d.deletions.value)}</span>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {primary.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3, ease: "easeOut" }}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight">
              {fmtNumber(s.delta.value)}
              {s.suffix && <span className="text-base text-muted">{s.suffix}</span>}
            </p>
            <DeltaLabel delta={s.delta} comparedTo={comparedTo} />
          </motion.div>
        ))}
      </div>

      <motion.dl
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border px-4 py-3 sm:grid-cols-5"
      >
        {secondary.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="font-mono text-sm tabular-nums">{s.value}</dd>
          </div>
        ))}
      </motion.dl>
    </div>
  );
}

function DeltaLabel({ delta, comparedTo }: { delta: Delta; comparedTo: string }) {
  if (delta.change === 0) return <p className="mt-1 font-mono text-xs text-muted">= {comparedTo}</p>;
  const up = delta.change > 0;
  return (
    <p className={`mt-1 truncate font-mono text-xs ${up ? "text-accent" : "text-muted"}`}>
      {up ? "↑" : "↓"} {Math.abs(delta.change)}{" "}
      <span className="text-muted">
        vs {delta.previous} {comparedTo}
      </span>
    </p>
  );
}
