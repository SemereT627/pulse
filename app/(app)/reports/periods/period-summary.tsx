"use client";

import { useState, useTransition } from "react";
import { CopyIcon, SparkIcon } from "@/components/icons";
import { buttonClass, primaryButtonClass } from "@/components/ui";
import type { PeriodKind } from "@/lib/report/periods";
import { writePeriodSummaryAction } from "../actions";

/** Written on demand and kept only in the page: edit it here, then copy it out. */
export function PeriodSummary({ kind, period, label, aiOn }: { kind: PeriodKind; period: string; label: string; aiOn: boolean }) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const write = () => {
    if (text && !window.confirm("Write a new summary? This replaces the text below, including your edits.")) return;
    startTransition(async () => {
      setError(null);
      const result = await writePeriodSummaryAction(kind, period);
      if (result.error) setError(result.error);
      else {
        setText(result.text ?? "");
        setModel(result.model ?? null);
      }
    });
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em]">
          Summary {model && <span className="normal-case tracking-normal text-muted">· {model}</span>}
        </h2>
        <div className="flex flex-wrap gap-2">
          {text && (
            <button type="button" onClick={copy} className={buttonClass}>
              <CopyIcon className="size-4" />
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          {aiOn && (
            <button type="button" onClick={write} disabled={pending} className={text ? buttonClass : primaryButtonClass}>
              <SparkIcon className="size-4" />
              {pending ? "Writing…" : text ? "Rewrite" : "Write with AI"}
            </button>
          )}
        </div>
      </div>

      <div className={`mt-4 transition-opacity ${pending ? "opacity-40" : ""}`}>
        {text !== null ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label={`Summary for ${label}`}
            rows={Math.min(28, Math.max(10, text.split("\n").length + 4))}
            className="w-full resize-y rounded-lg border border-border bg-background p-3 text-[15px] leading-relaxed outline-none focus:border-muted"
          />
        ) : (
          <p className="text-sm text-muted">
            {aiOn
              ? `Turn ${label}'s weekly reports into one summary, for a review or a catch-up with your manager. It isn't saved, so copy it when you're happy with it.`
              : "Add an AI key in Settings → AI summary to write period summaries."}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </section>
  );
}
