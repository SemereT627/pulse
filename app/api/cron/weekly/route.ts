import { timingSafeEqual } from "node:crypto";
import { aiEnabled } from "@/lib/ai/summary";
import { generateReport } from "@/lib/report/generate";
import { getSettings } from "@/lib/report/load";
import { isValidDate, previousWeek, weekContaining, weekFrom } from "@/lib/report/week";

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
 * Vercel Cron calls this every Friday (see vercel.json) and reports the week that just ended.
 * `?week=YYYY-MM-DD` regenerates a specific week instead.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getSettings();
  if (!settings.cronEnabled) return Response.json({ skipped: "cron disabled in settings" });

  const param = new URL(request.url).searchParams.get("week");
  if (param && !isValidDate(param)) return Response.json({ error: "Invalid week" }, { status: 400 });

  const week = param
    ? weekFrom(param, settings.timezone)
    : previousWeek(weekContaining(new Date(), settings.timezone, settings.weekStartDay));

  const report = await generateReport(week, "cron", { withNarrative: aiEnabled() && settings.aiEnabled });
  return Response.json({
    week: `${report.weekStart}..${report.weekEnd}`,
    generatedAt: report.generatedAt,
    totals: (report.stats as { totals: unknown }).totals,
    narrative: report.narrative ? `${report.narrative.length} chars (${report.narrativeModel})` : null,
  });
}
