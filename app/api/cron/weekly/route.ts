import { timingSafeEqual } from "node:crypto";
import { aiReady } from "@/lib/ai/providers";
import { generateReport, getReport } from "@/lib/report/generate";
import { getSettings } from "@/lib/report/load";
import { isValidDate, localDate, previousWeek, weekContaining, weekFrom } from "@/lib/report/week";

// Fetching every included repo can take a while on a cold cache.
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Vercel Cron calls this daily at 12:00 UTC (see vercel.json); it acts only on `settings.reportDay`
 * (in the report timezone) and reports the last finished week. `?week=YYYY-MM-DD` regenerates that week any day.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getSettings();
  if (!settings.cronEnabled) return Response.json({ skipped: "cron disabled in settings" });

  const param = new URL(request.url).searchParams.get("week");
  if (param && !isValidDate(param)) return Response.json({ error: "Invalid week" }, { status: 400 });

  const now = new Date();
  if (!param) {
    const today = new Date(`${localDate(now, settings.timezone)}T00:00:00Z`).getUTCDay();
    if (today !== settings.reportDay) return Response.json({ skipped: `report day is ${settings.reportDay}, today is ${today}` });
  }

  const week = param
    ? weekFrom(param, settings.timezone)
    : previousWeek(weekContaining(now, settings.timezone, settings.weekStartDay));

  // Keep a summary that's already there (written by hand, or by an earlier run); rewrite it from the report page.
  const existing = await getReport(week.startDate);
  const withNarrative = aiReady(settings) && !existing?.narrative;
  const report = await generateReport(week, "cron", { withNarrative });
  return Response.json({
    week: `${report.weekStart}..${report.weekEnd}`,
    generatedAt: report.generatedAt,
    totals: (report.stats as { totals: unknown }).totals,
    narrative: report.narrative ? `${report.narrative.length} chars (${report.narrativeModel})` : null,
  });
}
