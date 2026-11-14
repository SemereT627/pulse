export const PERIOD_KINDS = ["month", "quarter", "year"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The period a week belongs to, by the day it starts: "2026-11", "2026-Q4" or "2026". */
export function periodKey(weekStart: string, kind: PeriodKind): string {
  const year = weekStart.slice(0, 4);
  const month = Number(weekStart.slice(5, 7));
  if (kind === "year") return year;
  if (kind === "quarter") return `${year}-Q${Math.ceil(month / 3)}`;
  return weekStart.slice(0, 7);
}

export function isPeriodKey(key: string, kind: PeriodKind): boolean {
  const pattern = { year: /^\d{4}$/, quarter: /^\d{4}-Q[1-4]$/, month: /^\d{4}-(0[1-9]|1[0-2])$/ }[kind];
  return pattern.test(key);
}

/** "November 2026", "Q4 2026" or "2026". */
export function periodLabel(key: string): string {
  const [year, part] = key.split("-");
  if (!part) return year;
  if (part.startsWith("Q")) return `${part} ${year}`;
  return `${MONTHS[Number(part) - 1]} ${year}`;
}
