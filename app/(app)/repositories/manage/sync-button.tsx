"use client";

import { useTransition } from "react";
import { RefreshIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";
import { syncReposAction } from "./actions";

export function SyncButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => syncReposAction())}
      className={buttonClass}
    >
      <RefreshIcon className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Syncing…" : "Sync from GitHub"}
    </button>
  );
}
