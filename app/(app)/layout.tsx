import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { auth, signOut } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import { UserMenu } from "@/components/shell/user-menu";
import { WeekPicker } from "@/components/week-picker";
import { getRateLimit, getSettings, includedSources } from "@/lib/report/load";
import { addDays, weekContaining } from "@/lib/report/week";
import { fmtIn, fmtNumber } from "@/lib/format";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      sidebarFooter={
        <Suspense fallback={<div className="h-24" />}>
          <SidebarStatus />
        </Suspense>
      }
      topbarActions={
        <>
          <Suspense fallback={<div className="h-9 w-48" />}>
            <TopbarWeekPicker />
          </Suspense>
          <Suspense fallback={<div className="size-9 rounded-full bg-surface" />}>
            <TopbarUserMenu />
          </Suspense>
        </>
      }
    >
      {children}
    </AppShell>
  );
}

async function TopbarWeekPicker() {
  const settings = await getSettings();
  const current = weekContaining(new Date(), settings.timezone, settings.weekStartDay).startDate;
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(current, -7 * i));
  return <WeekPicker weeks={weeks} current={current} />;
}

async function TopbarUserMenu() {
  // auth() decrypts the session with crypto, which can't run during prerendering.
  await connection();
  const session = await auth();
  if (!session?.user) return null;
  return (
    <UserMenu
      name={session.user.name ?? null}
      login={session.user.login}
      image={session.user.image ?? null}
      signOut={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    />
  );
}

async function SidebarStatus() {
  const [settings, sources, rate] = await Promise.all([getSettings(), includedSources(), getRateLimit()]);
  const used = rate ? 1 - rate.remaining / rate.limit : 0;
  // vercel.json runs the cron Fridays 12:00 UTC; show it in the report's timezone.
  const cronTime = new Intl.DateTimeFormat("en-US", {
    timeZone: settings.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date("2026-01-02T12:00:00Z"));

  return (
    <dl className="space-y-3 font-mono text-[11px] text-muted">
      <div className="flex items-center justify-between">
        <dt>Tracked repos</dt>
        <dd>
          <Link href="/repositories/manage" className="text-foreground hover:text-accent">
            {sources.length}
          </Link>
        </dd>
      </div>
      <div className="flex items-center justify-between">
        <dt>Auto report</dt>
        <dd className={settings.cronEnabled ? "text-foreground" : ""}>{settings.cronEnabled ? `Fri ${cronTime}` : "off"}</dd>
      </div>
      {rate && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt>GitHub API</dt>
            <dd>
              {fmtNumber(rate.remaining)} left · {fmtIn(rate.resetAt)}
            </dd>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div className={`h-full rounded-full ${used > 0.8 ? "bg-danger" : "bg-accent"}`} style={{ width: `${Math.max(2, (1 - used) * 100)}%` }} />
          </div>
        </div>
      )}
    </dl>
  );
}
