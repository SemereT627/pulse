import { Suspense } from "react";
import Link from "next/link";
import { signOut } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import { UserMenu } from "@/components/shell/user-menu";
import { WeekPicker } from "@/components/week-picker";
import { getRateLimit, getSettings, includedSources } from "@/lib/report/load";
import { addDays, weekContaining } from "@/lib/report/week";
import { fmtIn, fmtNumber } from "@/lib/format";
import { currentUser } from "@/lib/session";

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
      <Suspense>
        <TokenBanner />
      </Suspense>
      {children}
    </AppShell>
  );
}

/** Shown when GitHub last rejected the user's token; cleared by signing in again or fixing the PAT. */
async function TokenBanner() {
  const user = await currentUser();
  if (!user.tokenInvalid) return null;
  return (
    <p className="mb-6 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {user.pat ? (
        <>
          GitHub rejected your personal access token.{" "}
          <Link href="/settings" className="underline">
            Replace or remove it in Settings
          </Link>
          .
        </>
      ) : (
        "GitHub no longer accepts your sign-in. Sign out and sign in again to keep your reports updating."
      )}
    </p>
  );
}

async function TopbarWeekPicker() {
  const settings = await getSettings(await currentUser());
  const current = weekContaining(new Date(), settings.timezone, settings.weekStartDay).startDate;
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(current, -7 * i));
  return <WeekPicker weeks={weeks} current={current} />;
}

async function TopbarUserMenu() {
  const user = await currentUser();
  return (
    <UserMenu
      name={user.name}
      login={user.login}
      image={user.avatarUrl}
      signOut={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    />
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function SidebarStatus() {
  const user = await currentUser();
  const [settings, sources, rate] = await Promise.all([getSettings(user), includedSources(user), getRateLimit(user)]);
  // The stored budget is from the last call; once its window has reset, the full limit is back.
  const resetPassed = rate ? rate.resetAt.getTime() <= new Date().getTime() : false;
  const remaining = rate ? (resetPassed ? rate.limit : rate.remaining) : 0;
  const used = rate ? 1 - remaining / rate.limit : 0;
  // vercel.json runs the cron daily at 12:00 UTC and it acts on the report day; show that time in the user's timezone.
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
        <dd className={settings.cronEnabled ? "text-foreground" : ""}>{settings.cronEnabled ? `${DAYS[settings.reportDay]} ${cronTime}` : "off"}</dd>
      </div>
      {rate && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <dt>GitHub API</dt>
            <dd>
              {fmtNumber(remaining)} left{resetPassed ? "" : ` · ${fmtIn(rate.resetAt)}`}
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
