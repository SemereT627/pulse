"use client";

import { useState } from "react";

export function ExportButtons({ markdown, filename }: { markdown: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  };

  const btn =
    "h-9 rounded-md border border-border px-3 font-mono text-xs text-muted transition-colors hover:bg-surface hover:text-foreground";

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={copy} className={btn}>
        {copied ? "Copied ✓" : "Copy .md"}
      </button>
      <button type="button" onClick={download} className={btn} aria-label="Download Markdown">
        ↓ .md
      </button>
    </div>
  );
}
