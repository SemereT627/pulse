"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { addDays, weekQuery } from "@/lib/report/week";
import { fmtRange } from "@/lib/format";
import { navItemFor } from "./shell/nav";

/** Sets `?week=` on the current section; hidden on sections that aren't about one week. */
export function WeekPicker({ weeks, current }: { weeks: string[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const param = useSearchParams().get("week");
  if (!navItemFor(pathname)?.weekScoped || pathname.startsWith("/repositories/manage") || pathname.startsWith("/reports/periods")) return null;

  // The server snaps odd dates to a week start; mirror that for the known weeks and trust the rest.
  const selected = param && param < current ? (weeks.find((w) => w <= param && param < addDays(w, 7)) ?? param) : current;
  const options = weeks.includes(selected) ? weeks : [selected, ...weeks];
  const hrefFor = (start: string) => `${pathname}${weekQuery(start, current)}`;
  const prev = addDays(selected, -7);
  const next = addDays(selected, 7);
  const btn =
    "flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground";

  return (
    <div className="flex items-center rounded-lg border border-border bg-surface/60">
      <Link href={hrefFor(prev)} className={btn} aria-label="Previous week">
        <ChevronLeftIcon />
      </Link>
      <select
        value={selected}
        onChange={(e) => router.push(hrefFor(e.target.value))}
        aria-label="Week"
        className="h-9 max-w-36 cursor-pointer appearance-none bg-transparent px-1 text-center font-mono text-xs outline-none sm:max-w-none"
      >
        {options.map((w) => (
          <option key={w} value={w}>
            {w === current ? "This week" : fmtRange(w, addDays(w, 6))}
          </option>
        ))}
      </select>
      {selected < current ? (
        <Link href={hrefFor(next)} className={btn} aria-label="Next week">
          <ChevronRightIcon />
        </Link>
      ) : (
        <span className={`${btn} pointer-events-none opacity-30`} aria-hidden="true">
          <ChevronRightIcon />
        </span>
      )}
    </div>
  );
}
