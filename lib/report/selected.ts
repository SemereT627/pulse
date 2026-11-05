import "server-only";
import type { User } from "@/db/schema";
import { getSettings } from "./load";
import { isValidDate, localMidnight, weekContaining } from "./week";

export type WeekSearchParams = Promise<{ week?: string | string[] }>;

/**
 * The week a dashboard page shows, from `?week=YYYY-MM-DD` (any day in it; snapped to the week start).
 * Missing, invalid, or future dates fall back to the week in progress.
 */
export async function selectedWeek(user: User, searchParams: WeekSearchParams) {
  const [{ week: param }, settings] = await Promise.all([searchParams, getSettings(user)]);
  const now = new Date();
  const current = weekContaining(now, settings.timezone, settings.weekStartDay);
  const picked =
    typeof param === "string" && isValidDate(param)
      ? weekContaining(localMidnight(param, settings.timezone), settings.timezone, settings.weekStartDay)
      : null;
  const week = picked && picked.startDate < current.startDate ? picked : current;
  return { settings, now, current, week, isCurrent: week.startDate === current.startDate };
}

