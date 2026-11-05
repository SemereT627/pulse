import { timingSafeEqual } from "node:crypto";
import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { aiReady, getAiKeys } from "@/lib/ai/providers";
import { generateReport, getReport } from "@/lib/report/generate";
import { getSettings, includedSources } from "@/lib/report/load";
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
 * Vercel Cron calls this daily at 12:00 UTC (see vercel.json). For each user whose report day it is (in their
 * timezone), it saves the last finished week. `?week=YYYY-MM-DD&user=<login>` regenerates one user's week any day.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const param = params.get("week");
  const login = params.get("user");
  if (param && (!isValidDate(param) || !login)) return Response.json({ error: "Use ?week=YYYY-MM-DD&user=<login>" }, { status: 400 });

  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.tokenInvalid, false),
        or(isNotNull(users.oauthToken), isNotNull(users.pat)),
        login ? sql`lower(${users.login}) = ${login.toLowerCase()}` : undefined,
      ),
    );

  // ponytail: users run one after another inside one 300s call; split into a request per user when this stops fitting.
  const results = [];
  for (const user of rows) {
    try {
      results.push({ user: user.id, ...(await runFor(user, param)) });
    } catch (e) {
      console.error(`cron: user ${user.id} failed`, e);
      results.push({ user: user.id, error: e instanceof Error ? e.message : "failed" });
    }
  }
  return Response.json({ users: results.length, results });
}

async function runFor(user: User, param: string | null) {
  const [settings, sources] = await Promise.all([getSettings(user), includedSources(user)]);
  if (!param && !settings.cronEnabled) return { skipped: "cron off" };
  if (sources.length === 0) return { skipped: "no tracked repos" };

  const now = new Date();
  if (!param) {
    const today = new Date(`${localDate(now, settings.timezone)}T00:00:00Z`).getUTCDay();
    if (today !== settings.reportDay) return { skipped: "not report day" };
  }

  const week = param
    ? weekFrom(param, settings.timezone)
    : previousWeek(weekContaining(now, settings.timezone, settings.weekStartDay));

  // Keep a summary that's already there (written by hand, or by an earlier run); rewrite it from the report page.
  const [existing, keys] = await Promise.all([getReport(user, week.startDate), getAiKeys(user.id)]);
  const withNarrative = aiReady(settings, keys) && !existing?.narrative;
  const report = await generateReport(user, week, "cron", { withNarrative });
  return {
    week: `${report.weekStart}..${report.weekEnd}`,
    narrative: report.narrative ? `${report.narrative.length} chars (${report.narrativeModel})` : null,
  };
}
