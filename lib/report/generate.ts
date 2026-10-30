import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { generateNarrative } from "@/lib/ai/narrative";
import { getSettings, loadWeek } from "./load";
import { toMarkdown } from "./markdown";
import { previousWeek, type WeekWindow } from "./week";
import type { Settings } from "@/db/schema";

export async function getReport(weekStart: string) {
  const [row] = await db.select().from(reports).where(eq(reports.weekStart, weekStart));
  return row ?? null;
}

/**
 * Build the week's stats + Markdown (and optionally the AI narrative) and store them in `reports`,
 * one row per week, replaced on rerun. Without `withNarrative`, an existing narrative is kept.
 */
export async function generateReport(week: WeekWindow, trigger: "cron" | "manual", opts: { withNarrative?: boolean } = {}) {
  const [{ stats }, existing, settings] = await Promise.all([loadWeek(week), getReport(week.startDate), getSettings()]);

  let narrative = existing?.narrative ?? null;
  let narrativeModel = existing?.narrativeModel ?? null;
  if (opts.withNarrative && stats.repos.length > 0) {
    const previous = await getReport(previousWeek(week).startDate);
    ({ text: narrative, model: narrativeModel } = await generateNarrative(stats, previous?.narrative ?? null, settings));
  }

  const markdown = toMarkdown(stats, week, markdownOptions(settings, narrative));
  const values = { weekEnd: week.endDate, stats, narrative, narrativeModel, markdown, trigger, generatedAt: new Date() };

  const [row] = await db
    .insert(reports)
    .values({ weekStart: week.startDate, ...values })
    .onConflictDoUpdate({ target: reports.weekStart, set: values })
    .returning();
  return row;
}

export function markdownOptions(settings: Settings, narrative: string | null) {
  return { author: settings.reportAuthor?.trim() || process.env.REPORT_NAME, narrative, sections: settings.mdSections };
}
