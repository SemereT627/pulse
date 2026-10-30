import "server-only";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { loadWeek } from "./load";
import { toMarkdown } from "./markdown";
import type { WeekWindow } from "./week";

/** Build the week's stats + Markdown and store them in `reports` (one row per week, replaced on rerun). */
export async function generateReport(week: WeekWindow, trigger: "cron" | "manual") {
  const { stats } = await loadWeek(week);
  const markdown = toMarkdown(stats, week, { author: process.env.REPORT_NAME });
  const values = { weekEnd: week.endDate, stats, markdown, trigger, generatedAt: new Date() };

  const [row] = await db
    .insert(reports)
    .values({ weekStart: week.startDate, ...values })
    .onConflictDoUpdate({ target: reports.weekStart, set: values })
    .returning();
  return row;
}
