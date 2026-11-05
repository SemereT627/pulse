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

const FAN_OUT = 10;

/**
 * Vercel Cron calls this daily at 12:00 UTC (see vercel.json). Without `user`, it calls itself once per user
 * (`?user=<login>`), so each user gets their own function run and time budget; each run saves the last finished
 * week if it's that user's report day (in their timezone). `?week=YYYY-MM-DD&user=<login>` regenerates one week any day.
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

  if (login) {
    const user = rows[0];
    if (!user) return Response.json({ error: `No active user ${login}` }, { status: 404 });
    try {
      return Response.json({ user: user.id, ...(await runFor(user, param)) });
    } catch (e) {
      console.error(`cron: user ${user.id} failed`, e);
      return Response.json({ user: user.id, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
    }
  }

  // The production domain, not the request's *.vercel.app host, which Deployment Protection puts behind a login.
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : new URL(request.url).origin;
  const results: unknown[] = [];
  for (let i = 0; i < rows.length; i += FAN_OUT) {
    const batch = rows.slice(i, i + FAN_OUT).map(async (user) => {
      try {
        const res = await fetch(`${base}/api/cron/weekly?user=${encodeURIComponent(user.login)}`, {
          headers: { authorization: request.headers.get("authorization") ?? "" },
        });
        return await res.json();
      } catch (e) {
        return { user: user.id, error: e instanceof Error ? e.message : "request failed" };
      }
    });
    results.push(...(await Promise.all(batch)));
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
