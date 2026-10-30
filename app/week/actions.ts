"use server";

import { refresh } from "next/cache";
import { aiEnabled } from "@/lib/ai/summary";
import { generateReport } from "@/lib/report/generate";
import { clearWeek, getSettings } from "@/lib/report/load";
import { isValidDate, weekFrom } from "@/lib/report/week";
import { requireUser } from "@/lib/session";

export async function regenerateWeekAction(weekStart: string) {
  await requireUser();
  if (!isValidDate(weekStart)) throw new Error("Invalid week");
  await clearWeek(weekStart);
  refresh();
}

export async function writeSummaryAction(weekStart: string): Promise<{ error?: string }> {
  await requireUser();
  if (!isValidDate(weekStart)) return { error: "Invalid week" };
  if (!aiEnabled()) return { error: "AI summaries are off (set AI_ENABLED and ANTHROPIC_API_KEY)." };

  const settings = await getSettings();
  try {
    await generateReport(weekFrom(weekStart, settings.timezone), "manual", { withNarrative: true });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't write the summary." };
  }
  refresh();
  return {};
}
