"use client";

import { useEffect } from "react";
import { RefreshIcon } from "@/components/icons";
import { primaryButtonClass } from "@/components/ui";

// Most failures here are network ones (GitHub unreachable with nothing cached for the week).
export default function SectionError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold tracking-tight">Couldn&apos;t load this page</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Pulse couldn&apos;t reach GitHub or the database, and has nothing saved for this week yet. Check your connection and
        try again.
      </p>
      <div className="mt-6 flex justify-center">
        <button type="button" onClick={() => retry()} className={primaryButtonClass}>
          <RefreshIcon className="size-4" /> Try again
        </button>
      </div>
    </div>
  );
}
