"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { aiReady, getAiKeys, noKey } from "@/lib/ai/providers";
import { generatePeriodNarrative } from "@/lib/ai/narrative";
import { editedModel, generateReport, getReport, markdownOptions, savedReports } from "@/lib/report/generate";
import { isPeriodKey, periodKey, periodLabel, PERIOD_KINDS, type PeriodKind } from "@/lib/report/periods";
import { toMarkdown } from "@/lib/report/markdown";
import type { WeekStats } from "@/lib/report/types";
import { expireWeek, getSettings } from "@/lib/report/load";
import { isValidDate, weekFrom } from "@/lib/report/week";
import { requireUser } from "@/lib/session";

export async function regenerateWeekAction(weekStart: string) {
  const user = await requireUser();
  if (!isValidDate(weekStart)) throw new Error("Invalid week");
  await expireWeek(user, weekStart);
  refresh();
}

export async function writeSummaryAction(weekStart: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!isValidDate(weekStart)) return { error: "Invalid week" };
  const [settings, keys] = await Promise.all([getSettings(user), getAiKeys(user.id)]);
  if (!settings.aiEnabled) return { error: "AI summaries are off in Settings." };
  if (!aiReady(settings, keys)) return { error: noKey(settings.aiProvider) };

  try {
    await generateReport(user, weekFrom(weekStart, settings.timezone), "manual", { withNarrative: true });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't write the summary." };
  }
  refresh();
  return {};
}

const MAX_NARRATIVE = 20_000;

/**
 * Saves a hand-edited (or hand-written) summary and rebuilds the stored Markdown with it.
 * Creates the week's report first if there isn't one, which needs GitHub to be reachable.
 */
export async function saveSummaryAction(weekStart: string, text: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!isValidDate(weekStart)) return { error: "Invalid week" };
  const narrative = text.replace(/\r\n/g, "\n").trim();
  if (narrative.length > MAX_NARRATIVE) return { error: "That's too long (20,000 characters max)." };

  const settings = await getSettings(user);
  const week = weekFrom(weekStart, settings.timezone);
  try {
    const report = (await getReport(user, weekStart)) ?? (await generateReport(user, week, "manual"));
    const narrativeModel = narrative ? editedModel(report.narrativeModel) : null;
    await db
      .update(reports)
      .set({
        narrative: narrative || null,
        narrativeModel,
        markdown: toMarkdown(report.stats as WeekStats, week, markdownOptions(user, settings, narrative || null)),
        generatedAt: new Date(),
      })
      .where(and(eq(reports.userId, user.id), eq(reports.weekStart, weekStart)));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't save the summary." };
  }
  refresh();
  return {};
}

/** Writes a month/quarter/year summary from that period's saved weekly reports. Not stored: the user copies it. */
export async function writePeriodSummaryAction(kind: PeriodKind, key: string): Promise<{ text?: string; model?: string; error?: string }> {
  const user = await requireUser();
  if (!PERIOD_KINDS.includes(kind) || !isPeriodKey(key, kind)) return { error: "Invalid period" };
  const [settings, keys, rows] = await Promise.all([getSettings(user), getAiKeys(user.id), savedReports(user)]);
  if (!aiReady(settings, keys)) return { error: noKey(settings.aiProvider) };
  const weeks = rows.filter((r) => periodKey(r.weekStart, kind) === key);
  if (weeks.length === 0) return { error: "No saved weekly reports in this period." };
  try {
    return await generatePeriodNarrative(periodLabel(key), weeks, settings, keys[settings.aiProvider]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't write the summary." };
  }
}
