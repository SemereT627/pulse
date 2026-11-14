import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { generateNarrative } from "@/lib/ai/narrative";
import { getAiKeys } from "@/lib/ai/providers";
import { getSettings, loadWeek } from "./load";
import { toMarkdown } from "./markdown";
import type { WeekStats } from "./types";
import { previousWeek, type WeekWindow } from "./week";
import type { Settings, User } from "@/db/schema";

/** The user's saved weekly reports, oldest first: what period summaries are built from. */
export async function savedReports(user: Pick<User, "id">) {
  const rows = await db
    .select({ weekStart: reports.weekStart, weekEnd: reports.weekEnd, narrative: reports.narrative, stats: reports.stats })
    .from(reports)
    .where(eq(reports.userId, user.id))
    .orderBy(asc(reports.weekStart));
  return rows.map((r) => ({ ...r, stats: r.stats as WeekStats }));
}

export async function getReport(user: Pick<User, "id">, weekStart: string) {
  const [row] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.userId, user.id), eq(reports.weekStart, weekStart)));
  return row ?? null;
}

/**
 * Build the week's stats + Markdown (and optionally the AI narrative) and store them in `reports`,
 * one row per week, replaced on rerun. Without `withNarrative`, an existing narrative is kept.
 */
export async function generateReport(
  user: User,
  week: WeekWindow,
  trigger: "cron" | "manual",
  opts: { withNarrative?: boolean } = {},
) {
  const [{ stats, fetchError }, existing, settings] = await Promise.all([
    loadWeek(user, week),
    getReport(user, week.startDate),
    getSettings(user),
  ]);
  // A saved report should reflect GitHub, not whatever happened to be cached when the network dropped.
  if (fetchError) throw new Error(`Couldn't reach GitHub, so the report wasn't saved: ${fetchError}`);

  let narrative = existing?.narrative ?? null;
  let narrativeModel = existing?.narrativeModel ?? null;
  if (opts.withNarrative && stats.repos.length > 0) {
    const [previous, keys] = await Promise.all([getReport(user, previousWeek(week).startDate), getAiKeys(user.id)]);
    ({ text: narrative, model: narrativeModel } = await generateNarrative(
      stats,
      previous?.narrative ?? null,
      settings,
      keys[settings.aiProvider],
    ));
  }

  const markdown = toMarkdown(stats, week, markdownOptions(user, settings, narrative));
  const values = { weekEnd: week.endDate, stats, narrative, narrativeModel, markdown, trigger, generatedAt: new Date() };

  const [row] = await db
    .insert(reports)
    .values({ userId: user.id, weekStart: week.startDate, ...values })
    .onConflictDoUpdate({ target: [reports.userId, reports.weekStart], set: values })
    .returning();
  return row;
}

export function markdownOptions(user: Pick<User, "name" | "login">, settings: Settings, narrative: string | null) {
  const author = settings.reportAuthor?.trim() || user.name?.trim() || user.login;
  return { author, narrative, sections: settings.mdSections };
}

export { editedModel, isEdited } from "./edited";
