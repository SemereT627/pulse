"use client";

import { useTransition } from "react";
import { regenerateWeekAction } from "@/app/week/actions";

export function RegenerateButton({ weekStart }: { weekStart: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => regenerateWeekAction(weekStart))}
      title="Refetch this week from GitHub"
      className="h-9 rounded-md border border-border px-3 font-mono text-xs text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
    >
      {pending ? "Refetching…" : "Refresh"}
    </button>
  );
}
