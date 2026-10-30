// Week windows are computed in the report timezone, then expressed as UTC instants for GitHub queries.

export type WeekWindow = {
  /** Local calendar date the week starts on, YYYY-MM-DD (also the URL + DB key). */
  startDate: string;
  /** Local calendar date of the last day in the week, YYYY-MM-DD. */
  endDate: string;
  /** UTC instant of local midnight at startDate. */
  start: Date;
  /** UTC instant of local midnight the day after endDate (exclusive). */
  end: Date;
  timezone: string;
};

const DAY_MS = 86_400_000;

/** Offset of `timezone` from UTC at `instant`, in ms (e.g. +3h for Africa/Addis_Ababa). */
export function tzOffsetMs(instant: Date, timezone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Local calendar date (YYYY-MM-DD) of `instant` in `timezone`. */
export function localDate(instant: Date, timezone: string): string {
  return new Date(instant.getTime() + tzOffsetMs(instant, timezone)).toISOString().slice(0, 10);
}

/** UTC instant of local midnight on `date` (YYYY-MM-DD) in `timezone`. */
export function localMidnight(date: string, timezone: string): Date {
  const guess = new Date(`${date}T00:00:00Z`);
  const first = new Date(guess.getTime() - tzOffsetMs(guess, timezone));
  // Re-check once in case the offset differs on either side of a DST change.
  return new Date(guess.getTime() - tzOffsetMs(first, timezone));
}

export function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T00:00:00Z`).getTime());
}

/** The week (starting on `weekStartDay`, 0 = Sunday) that contains `instant`. */
export function weekContaining(instant: Date, timezone: string, weekStartDay: number): WeekWindow {
  const today = localDate(instant, timezone);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return weekFrom(addDays(today, -((weekday - weekStartDay + 7) % 7)), timezone);
}

export function weekFrom(startDate: string, timezone: string): WeekWindow {
  const endDate = addDays(startDate, 6);
  return {
    startDate,
    endDate,
    start: localMidnight(startDate, timezone),
    end: localMidnight(addDays(startDate, 7), timezone),
    timezone,
  };
}

export function previousWeek(week: WeekWindow): WeekWindow {
  return weekFrom(addDays(week.startDate, -7), week.timezone);
}

/** Local dates of each day in the week, in order. */
export function daysOf(week: WeekWindow): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week.startDate, i));
}
