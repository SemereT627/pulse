"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { writeSummaryAction } from "@/app/(app)/reports/actions";

type Props = { weekStart: string; narrative: string | null; hasActivity: boolean; isCurrent: boolean };

export function SummaryCard({ weekStart, narrative, hasActivity, isCurrent }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const write = () =>
    startTransition(async () => {
      setError(null);
      const result = await writeSummaryAction(weekStart);
      if (result.error) setError(result.error);
    });

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em]">Summary</h2>
        {hasActivity && (
          <button
            type="button"
            onClick={write}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
          >
            {pending ? "Writing…" : narrative ? "Rewrite" : "Write summary"}
          </button>
        )}
      </div>

      <div className={`mt-4 transition-opacity ${pending ? "opacity-40" : ""}`}>
        {narrative ? (
          <div className="space-y-3 text-[15px] leading-relaxed">
            {narrative.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            {!hasActivity
              ? "Nothing to summarize yet."
              : isCurrent
                ? "Week still in progress — you can write a draft now and rewrite it later."
                : "Turn this week's PRs and commits into a few paragraphs for your manager."}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </motion.section>
  );
}
