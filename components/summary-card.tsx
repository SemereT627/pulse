"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { saveSummaryAction, writeSummaryAction } from "@/app/(app)/reports/actions";
import { CopyIcon } from "@/components/icons";

type Props = {
  weekStart: string;
  narrative: string | null;
  hasActivity: boolean;
  isCurrent: boolean;
  /** AI provider ready; without it the summary can still be written by hand. */
  aiOn: boolean;
  /** The summary has hand edits that a rewrite would replace. */
  edited: boolean;
  /** Shown under the empty state when the user hasn't added an AI key. */
  keyNotice?: React.ReactNode;
};

const btn =
  "rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:bg-background hover:text-foreground disabled:opacity-50";

export function SummaryCard({ weekStart, narrative, hasActivity, isCurrent, aiOn, edited, keyNotice }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null); // null = not editing
  const [copied, setCopied] = useState(false);
  const editing = draft !== null;

  const run = (action: () => Promise<{ error?: string }>, onDone?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (result.error) setError(result.error);
      else onDone?.();
    });

  const write = () => {
    if (edited && !window.confirm("Rewrite will replace your edits with a new AI summary. Continue?")) return;
    run(() => writeSummaryAction(weekStart));
  };
  const save = () =>
    run(
      () => saveSummaryAction(weekStart, draft ?? ""),
      () => setDraft(null),
    );
  const copy = async () => {
    await navigator.clipboard.writeText(narrative ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em]">
          Summary {edited && <span className="normal-case tracking-normal text-muted">· edited</span>}
        </h2>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button type="button" onClick={() => setDraft(null)} disabled={pending} className={btn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="rounded-md bg-accent px-3 py-1.5 font-mono text-xs text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <>
              {narrative && (
                <button type="button" onClick={copy} className={`${btn} inline-flex items-center gap-1.5`}>
                  <CopyIcon className="size-3.5" />
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
              {hasActivity && (
                <button type="button" onClick={() => setDraft(narrative ?? "")} disabled={pending} className={btn}>
                  {narrative ? "Edit" : "Write it yourself"}
                </button>
              )}
              {hasActivity && aiOn && (
                <button type="button" onClick={write} disabled={pending} className={btn}>
                  {pending ? "Writing…" : narrative ? "Rewrite" : "Write with AI"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className={`mt-4 transition-opacity ${pending && !editing ? "opacity-40" : ""}`}>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Summary"
            autoFocus
            rows={Math.min(24, Math.max(8, draft.split("\n").length + 4))}
            placeholder="A few paragraphs for your manager. Leave a blank line between paragraphs."
            className="w-full resize-y rounded-lg border border-border bg-background p-3 text-[15px] leading-relaxed outline-none focus:border-muted"
          />
        ) : narrative ? (
          <div className="space-y-3 text-[15px] leading-relaxed">
            {narrative.split(/\n{2,}/).map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {!hasActivity
                ? "Nothing to summarize yet."
                : isCurrent
                  ? "Week still in progress. You can write a draft now and change it later."
                  : aiOn
                    ? "Turn this week's PRs and commits into a few paragraphs for your manager, or write them yourself."
                    : "Write a few paragraphs for your manager, or let AI draft them."}
            </p>
            {keyNotice}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </motion.section>
  );
}
