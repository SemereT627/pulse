import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AiKeyNotice } from "@/components/ai-key-notice";
import { PageHeader, Skeleton } from "@/components/ui";
import { getAiKeys, modelFor, PROVIDERS, type ProviderId } from "@/lib/ai/providers";
import { decrypt, lastFour } from "@/lib/crypto";
import { getRateLimit, getSettings, includedSources } from "@/lib/report/load";
import { fmtIn, fmtNumber } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { AiForm, CountsForm, DeleteAccount, PatForm, ReportForm, ThemePicker, WeekForm } from "./forms";
import { Toggle } from "./toggle";

export const metadata: Metadata = { title: "Settings" };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SettingsPage() {
  return (
    <div className="max-w-4xl space-y-10">
      <PageHeader title="Settings" description="How Pulse counts your work, writes your update, and when it runs." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SettingsSections />
      </Suspense>
    </div>
  );
}

async function SettingsSections() {
  const user = await currentUser();
  const [settings, rate, sources, keys] = await Promise.all([
    getSettings(user),
    getRateLimit(user),
    includedSources(user),
    getAiKeys(user.id),
  ]);
  const endDay = DAYS[(settings.weekStartDay + 6) % 7];
  const ids = Object.keys(PROVIDERS) as ProviderId[];
  const providers = ids.map((id) => ({
    id,
    label: PROVIDERS[id].label,
    defaultModel: PROVIDERS[id].defaultModel,
    hint: PROVIDERS[id].hint,
    savedKey: keys[id] ? lastFour(keys[id]) : null, // masked; the key never leaves the server
  }));
  const savedPat = user.pat ? lastFour(decrypt(user.pat)) : null;
  const active = providers.find((p) => p.id === settings.aiProvider)!;
  // vercel.json runs the cron daily at 12:00 UTC; show it in the report's timezone.
  const cronTime = new Intl.DateTimeFormat("en-US", {
    timeZone: settings.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date("2026-01-02T12:00:00Z"));

  return (
    <>
      <Section id="ai" title="AI summary" description="A first-person update for your manager, written from the week's PRs and commits.">
        <Row
          label="Write summaries"
          hint={
            active.savedKey
              ? `Using ${active.label} · ${modelFor(settings)}`
              : `${active.label} has no key yet, so nothing is written until you add one or switch provider.`
          }
          control={<Toggle name="aiEnabled" label="Write summaries" checked={settings.aiEnabled} />}
        />
        {!active.savedKey && (
          <div className="px-4 py-3.5">
            <AiKeyNotice provider={active.label} hint={active.hint} linkToSettings={false} />
          </div>
        )}
        <AiForm settings={settings} providers={providers} />
      </Section>

      <Section title="What counts" description="Which activity goes into your numbers and report.">
        <CountsForm settings={settings} />
      </Section>

      <Section title="Report and schedule">
        <Row
          label="Automatic report"
          hint={`Saves the finished week every ${DAYS[settings.reportDay]} at ${cronTime}. A summary already written is kept.`}
          control={<Toggle name="cronEnabled" label="Automatic report" checked={settings.cronEnabled} />}
        />
        <ReportForm settings={settings} defaultAuthor={user.name ?? user.login} cronTime={cronTime} />
      </Section>

      <Section title="Report week" description={`${DAYS[settings.weekStartDay]} 00:00 → ${endDay} 23:59, ${settings.timezone}.`}>
        <WeekForm settings={settings} timezones={Intl.supportedValuesOf("timeZone")} />
        <Row label="Tracked repos">
          <Link href="/repositories/manage" className="hover:text-accent">
            {sources.length} repos →
          </Link>
        </Row>
      </Section>

      <Section title="Appearance" description="Saved on this device.">
        <Row label="Theme" control={<ThemePicker />} />
      </Section>

      <Section title="GitHub" description="Pulse reads your activity with your own GitHub access.">
        <Row label="Reading with" hint={user.tokenInvalid ? "GitHub rejected this token. Sign in again or update the token below." : undefined}>
          <Status ok={!user.tokenInvalid}>{user.pat ? "Personal access token" : "Your GitHub sign-in"}</Status>
        </Row>
        <PatForm savedPat={savedPat} />
        <Row label="API budget">
          {rate ? (
            <span className="font-mono text-xs">
              {fmtNumber(rate.remaining)}/{fmtNumber(rate.limit)} calls · resets {fmtIn(rate.resetAt)}
            </span>
          ) : (
            <Status ok={false}>No calls yet</Status>
          )}
        </Row>
      </Section>

      <Section title="Account">
        <Row label="Signed in as">
          <span className="font-mono text-xs">@{user.login}</span>
        </Row>
        <Row label="Delete account" hint="Removes everything Pulse stores about you. To also revoke access on GitHub, see Settings → Applications there.">
          <DeleteAccount login={user.login} />
        </Row>
      </Section>
    </>
  );
}
function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
      <div>
        <h2 className="font-display font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      <div className="min-w-0 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">{children}</div>
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
