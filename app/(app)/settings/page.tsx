import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { PageHeader, Skeleton } from "@/components/ui";
import { aiEnabled, SUMMARY_MODEL } from "@/lib/ai/summary";
import { getRateLimit, getSettings, includedSources } from "@/lib/report/load";
import { fmtIn, fmtNumber } from "@/lib/format";
import { Toggle } from "./toggle";

export const metadata: Metadata = { title: "Settings" };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Settings" description="How Pulse builds and delivers your weekly report." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SettingsSections />
      </Suspense>
    </div>
  );
}

async function SettingsSections() {
  await connection(); // before auth(), see TopbarUserMenu
  const [settings, rate, sources, session] = await Promise.all([getSettings(), getRateLimit(), includedSources(), auth()]);
  const aiReady = aiEnabled();
  const endDay = DAYS[(settings.weekStartDay + 6) % 7];

  return (
    <>
      <Section title="Report week" description="Agreed and fixed; changing these would shift every stored week.">
        <Row label="Week runs">
          {DAYS[settings.weekStartDay]} 00:00 → {endDay} 23:59
        </Row>
        <Row label="Timezone">
          <span className="font-mono text-xs">{settings.timezone}</span>
        </Row>
        <Row label="Tracked repos">
          <Link href="/repositories/manage" className="hover:text-accent">
            {sources.length} repos →
          </Link>
        </Row>
      </Section>

      <Section title="Automation">
        <Row
          label="Friday report"
          hint="Vercel Cron saves the week that just ended every Friday at 12:00 UTC."
          control={<Toggle name="cronEnabled" label="Friday report" checked={settings.cronEnabled} />}
        />
        <Row
          label="AI summary"
          hint={
            aiReady
              ? `Writes a first-person update for your manager with ${SUMMARY_MODEL}.`
              : "Needs AI_ENABLED=true and ANTHROPIC_API_KEY in the environment before this has any effect."
          }
          control={<Toggle name="aiEnabled" label="AI summary" checked={settings.aiEnabled} />}
        />
      </Section>

      <Section title="Connections">
        <Row label="GitHub" hint="All data comes from the GITHUB_PAT token (repo, read:org, read:user).">
          {rate ? (
            <span className="font-mono text-xs">
              {fmtNumber(rate.remaining)}/{fmtNumber(rate.limit)} calls · resets {fmtIn(rate.resetAt)}
            </span>
          ) : (
            <Status ok={false}>No calls yet</Status>
          )}
        </Row>
        <Row label="Anthropic">
          <Status ok={aiReady}>{aiReady ? "Configured" : "Not configured"}</Status>
        </Row>
        <Row label="Email delivery" hint="Sending the report by email isn't built yet.">
          <Status ok={false}>Not set up</Status>
        </Row>
      </Section>

      {session?.user && (
        <Section title="Account">
          <Row label="Signed in as">
            <span className="font-mono text-xs">@{session.user.login}</span>
          </Row>
        </Section>
      )}
    </>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
      <div>
        <h2 className="font-display font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  control,
  children,
}: {
  label: string;
  hint?: string;
  control?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0 text-right text-sm">{control ?? children}</div>
    </div>
  );
}

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={`size-1.5 rounded-full ${ok ? "bg-accent" : "bg-muted"}`} />
      {children}
    </span>
  );
}
