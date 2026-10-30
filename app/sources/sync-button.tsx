"use client";

import { useTransition } from "react";
import { syncReposAction } from "./actions";

export function SyncButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => syncReposAction())}
      className="shrink-0 rounded-md border border-border px-3 py-2 font-mono text-xs transition-colors hover:bg-surface disabled:opacity-50"
    >
      {pending ? "Syncing…" : "Sync from GitHub"}
    </button>
  );
}
