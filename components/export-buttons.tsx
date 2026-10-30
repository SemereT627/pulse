"use client";

import { useState } from "react";
import { CopyIcon, DownloadIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";

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

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={copy} className={buttonClass}>
        <CopyIcon className="size-4" />
        {copied ? "Copied" : "Copy Markdown"}
      </button>
      <button type="button" onClick={download} className={buttonClass} aria-label="Download Markdown">
        <DownloadIcon className="size-4" />
        .md
      </button>
    </div>
  );
}
