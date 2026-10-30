export const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export function fmtDay(date: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(new Date(`${date}T00:00:00Z`));
}

export function fmtRange(startDate: string, endDate: string) {
  const sameMonth = startDate.slice(0, 7) === endDate.slice(0, 7);
  const start = fmtDay(startDate, { month: "short", day: "numeric" });
  const end = fmtDay(endDate, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${start} – ${end}`;
}

export function fmtHours(h: number | null) {
  if (h === null) return "—";
  if (h < 1) return "<1h";
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function fmtAgo(date: Date, now = Date.now()) {
  const mins = Math.round((now - date.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function fmtIn(date: Date, now = Date.now()) {
  const mins = Math.max(0, Math.round((date.getTime() - now) / 60_000));
  return mins < 60 ? `in ${mins}m` : `in ${Math.round(mins / 60)}h`;
}

export function fmtTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
