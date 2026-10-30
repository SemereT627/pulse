import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { generateNarrative, SUMMARY_MODEL } from "@/lib/ai/summary";
import { loadWeek } from "./load";
import { toMarkdown } from "./markdown";
import { previousWeek, type WeekWindow } from "./week";

export async function getReport(weekStart: string) {
  const [row] = await db.select().from(reports).where(eq(reports.weekStart, weekStart));
  return row ?? null;
}

/**
 * Build the week's stats + Markdown (and optionally the AI narrative) and store them in `reports`,
 * one row per week, replaced on rerun. Without `withNarrative`, an existing narrative is kept.
 */
export async function generateReport(week: WeekWindow, trigger: "cron" | "manual", opts: { withNarrative?: boolean } = {}) {
  const [{ stats }, existing] = await Promise.all([loadWeek(week), getReport(week.startDate)]);

  let narrative = existing?.narrative ?? null;
  let narrativeModel = existing?.narrativeModel ?? null;
  if (opts.withNarrative && stats.repos.length > 0) {
    const previous = await getReport(previousWeek(week).startDate);
    narrative = await generateNarrative(stats, previous?.narrative ?? null);
    narrativeModel = SUMMARY_MODEL;
  }

  const markdown = toMarkdown(stats, week, { author: process.env.REPORT_NAME, narrative });
  const values = { weekEnd: week.endDate, stats, narrative, narrativeModel, markdown, trigger, generatedAt: new Date() };

  const [row] = await db
    .insert(reports)
    .values({ weekStart: week.startDate, ...values })
    .onConflictDoUpdate({ target: reports.weekStart, set: values })
    .returning();
  return row;
}
