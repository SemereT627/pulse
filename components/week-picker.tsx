"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "@/lib/report/week";
import { fmtRange } from "@/lib/format";

const hrefFor = (start: string, current: string) => (start === current ? "/" : `/week/${start}`);

export function WeekPicker({ weeks, selected, current }: { weeks: string[]; selected: string; current: string }) {
  const router = useRouter();
  const prev = addDays(selected, -7);
  const next = addDays(selected, 7);
  const options = weeks.includes(selected) ? weeks : [selected, ...weeks];
  const btn =
    "flex size-9 items-center justify-center rounded-md border border-border font-mono text-sm text-muted transition-colors hover:bg-surface hover:text-foreground";

  return (
    <div className="flex items-center gap-2">
      <Link href={hrefFor(prev, current)} className={btn} aria-label="Previous week">
        ‹
      </Link>
      <select
        value={selected}
        onChange={(e) => router.push(hrefFor(e.target.value, current))}
        aria-label="Week"
        className="h-9 rounded-md border border-border bg-background px-2 font-mono text-xs"
      >
        {options.map((w) => (
          <option key={w} value={w}>
            {w === current ? "This week" : fmtRange(w, addDays(w, 6))}
          </option>
        ))}
      </select>
      {selected < current ? (
        <Link href={hrefFor(next, current)} className={btn} aria-label="Next week">
          ›
        </Link>
      ) : (
        <span className={`${btn} pointer-events-none opacity-30`}>›</span>
      )}
    </div>
  );
}
