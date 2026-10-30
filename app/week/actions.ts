"use server";

import { refresh } from "next/cache";
import { clearWeek } from "@/lib/report/load";
import { isValidDate } from "@/lib/report/week";
import { requireUser } from "@/lib/session";

export async function regenerateWeekAction(weekStart: string) {
  await requireUser();
  if (!isValidDate(weekStart)) throw new Error("Invalid week");
  await clearWeek(weekStart);
  refresh();
}
