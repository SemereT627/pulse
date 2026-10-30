"use client";

import { useTransition } from "react";
import { RefreshIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";
import { regenerateWeekAction } from "@/app/(app)/reports/actions";

export function RegenerateButton({ weekStart }: { weekStart: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => regenerateWeekAction(weekStart))}
      title="Refetch this week from GitHub"
      className={buttonClass}
    >
      <RefreshIcon className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Refetching…" : "Refresh"}
    </button>
  );
}
