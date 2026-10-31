"use server";

import { refresh } from "next/cache";
import { aiReady, PROVIDERS } from "@/lib/ai/providers";
import { generateReport } from "@/lib/report/generate";
import { expireWeek, getSettings } from "@/lib/report/load";
import { isValidDate, weekFrom } from "@/lib/report/week";
import { requireUser } from "@/lib/session";

export async function regenerateWeekAction(weekStart: string) {
  await requireUser();
  if (!isValidDate(weekStart)) throw new Error("Invalid week");
  await expireWeek(weekStart);
  refresh();
}

export async function writeSummaryAction(weekStart: string): Promise<{ error?: string }> {
  await requireUser();
  if (!isValidDate(weekStart)) return { error: "Invalid week" };
  const settings = await getSettings();
  if (!settings.aiEnabled) return { error: "AI summaries are off in Settings." };
  if (!aiReady(settings)) return { error: `${PROVIDERS[settings.aiProvider].label} has no API key. Add ${PROVIDERS[settings.aiProvider].hint}.` };

  try {
    await generateReport(weekFrom(weekStart, settings.timezone), "manual", { withNarrative: true });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't write the summary." };
  }
  refresh();
  return {};
}
