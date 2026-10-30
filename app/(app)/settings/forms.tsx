"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { Settings } from "@/db/schema";
import { primaryButtonClass, buttonClass } from "@/components/ui";
import { saveSettingsAction, testProviderAction, type SaveState } from "./actions";

const field =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-muted";

type ProviderInfo = { id: Settings["aiProvider"]; label: string; defaultModel: string; hint: string; keyEnv: string | null };

function SectionForm({ section, children }: { section: string; children: React.ReactNode }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveSettingsAction, {});
  const [dirty, setDirty] = useState(false);

  return (
    <form action={action} onChange={() => setDirty(true)} onSubmit={() => setDirty(false)}>
      <input type="hidden" name="section" value={section} />
      <div className="divide-y divide-border">{children}</div>
      <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
        <p aria-live="polite" className={`text-xs ${state.error ? "text-danger" : "text-muted"}`}>
          {state.error ?? (dirty ? "Unsaved changes" : state.ok ? "Saved" : "")}
        </p>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-6">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Check({ name, label, defaultChecked, value }: { name: string; label: string; defaultChecked: boolean; value?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="size-4 accent-[var(--accent)]" />
      {label}
    </label>
  );
}

export function AiForm({ settings, providers }: { settings: Settings; providers: ProviderInfo[] }) {
  const [provider, setProvider] = useState(settings.aiProvider);
  const [models, setModels] = useState<string[]>([]);
  const [test, setTest] = useState<{ ok?: string; error?: string }>({});
  const [testing, startTest] = useTransition();
  const current = providers.find((p) => p.id === provider)!;

  const runTest = () =>
    startTest(async () => {
      setTest({});
      const result = await testProviderAction(provider);
      if (result.error) setTest({ error: result.error });
      else {
        setModels(result.models ?? []);
        setTest({ ok: `Connected · ${result.models?.length ?? 0} models available` });
      }
    });

  return (
    <SectionForm section="ai">
      <Field
        label="Provider"
        htmlFor="aiProvider"
        hint={current.keyEnv ? `Key from ${current.keyEnv}` : `No key yet: add ${current.hint}`}
      >
        <div className="flex gap-2">
          <select
            id="aiProvider"
            name="aiProvider"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as Settings["aiProvider"]);
              setModels([]);
              setTest({});
            }}
            className={field}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.keyEnv ? "" : " (no key)"}
              </option>
            ))}
          </select>
          <button type="button" onClick={runTest} disabled={testing || !current.keyEnv} className={`${buttonClass} shrink-0`}>
            {testing ? "Testing…" : "Test"}
          </button>
        </div>
        {(test.ok || test.error) && (
          <p className={`mt-1.5 text-xs ${test.error ? "text-danger" : "text-accent"}`}>{test.error ?? test.ok}</p>
        )}
      </Field>
      <Field label="Model" htmlFor="aiModel" hint={`Leave empty for ${current.defaultModel}. Test the connection to list models.`}>
        <input
          id="aiModel"
          name="aiModel"
          // Remount when the provider changes, so a model id from another provider doesn't carry over.
          key={provider}
          defaultValue={provider === settings.aiProvider ? (settings.aiModel ?? "") : ""}
          placeholder={current.defaultModel}
          list="ai-models"
          autoComplete="off"
          className={`${field} font-mono text-xs`}
        />
        <datalist id="ai-models">
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
      <Field label="Tone" htmlFor="aiTone">
        <select id="aiTone" name="aiTone" defaultValue={settings.aiTone} className={field}>
          <option value="professional">Professional</option>
          <option value="conversational">Conversational</option>
          <option value="concise">Concise</option>
        </select>
      </Field>
      <Field label="Length" htmlFor="aiLength">
        <select id="aiLength" name="aiLength" defaultValue={settings.aiLength} className={field}>
          <option value="short">Short · 1-2 paragraphs</option>
          <option value="medium">Medium · 2-4 paragraphs</option>
          <option value="long">Long · 4-6 paragraphs</option>
        </select>
      </Field>
      <Field label="Your instructions" htmlFor="aiInstructions" hint="Added to every prompt, e.g. names to use or things to always mention.">
        <textarea
          id="aiInstructions"
          name="aiInstructions"
          defaultValue={settings.aiInstructions ?? ""}
          rows={3}
          maxLength={2000}
          placeholder="Refer to the project as OmniFleet. Mention blockers if a PR stayed open."
          className={`${field} h-auto py-2`}
        />
      </Field>
      <Field label="Context" hint="Lets the model say “continued” instead of repeating itself.">
        <Check name="aiUsePrevious" label="Give it last week's summary" defaultChecked={settings.aiUsePrevious} />
      </Field>
    </SectionForm>
  );
}

export function CountsForm({ settings }: { settings: Settings }) {
  return (
    <SectionForm section="counts">
      <Field label="Promotion PRs" hint="PRs from an extra branch (like dev) into the default branch only move work that's already counted.">
        <Check name="excludePromotionPrs" label="Don't count them" defaultChecked={settings.excludePromotionPrs} />
      </Field>
      <Field
        label="Other GitHub accounts"
        htmlFor="extraAuthorLogins"
        hint="Commits by these accounts count as yours. Comma-separated, up to 5."
      >
        <input
          id="extraAuthorLogins"
          name="extraAuthorLogins"
          defaultValue={settings.extraAuthorLogins.join(", ")}
          placeholder="SemereT627"
          autoComplete="off"
          className={`${field} font-mono text-xs`}
        />
      </Field>
      <Field label="Default extra branches" htmlFor="defaultExtraBranches" hint="Given to repos the next sync finds. Existing repos keep their own.">
        <input
          id="defaultExtraBranches"
          name="defaultExtraBranches"
          defaultValue={settings.defaultExtraBranches.join(", ")}
          placeholder="dev"
          autoComplete="off"
          className={`${field} font-mono text-xs`}
        />
      </Field>
    </SectionForm>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SECTION_LABELS: Record<string, string> = {
  summary: "AI summary",
  commits: "Commits",
  reviews: "Reviews",
  releases: "Releases",
};

export function ReportForm({ settings, envAuthor, cronTime }: { settings: Settings; envAuthor: string | null; cronTime: string }) {
  return (
    <SectionForm section="report">
      <Field label="Your name" htmlFor="reportAuthor" hint="Shown in the report's title.">
        <input
          id="reportAuthor"
          name="reportAuthor"
          defaultValue={settings.reportAuthor ?? ""}
          placeholder={envAuthor ?? "Your name"}
          maxLength={100}
          className={field}
        />
      </Field>
      <Field label="Markdown includes" hint="Pull requests and the headline are always in.">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(SECTION_LABELS).map(([value, label]) => (
            <Check key={value} name="mdSections" value={value} label={label} defaultChecked={settings.mdSections.includes(value)} />
          ))}
        </div>
      </Field>
      <Field label="Automatic report day" htmlFor="reportDay" hint={`Runs at ${cronTime} and saves the last finished week.`}>
        <select id="reportDay" name="reportDay" defaultValue={settings.reportDay} className={field}>
          {DAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </Field>
    </SectionForm>
  );
}

const THEMES = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

function applyTheme(value: string) {
  const root = document.documentElement;
  if (value === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", value);
}

/** Per device: stored in localStorage and applied before paint by the script in app/layout.tsx. */
export function ThemePicker() {
  const [theme, setTheme] = useState<string>("system");

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser-only value after hydration
      setTheme(localStorage.getItem("pulse-theme") ?? "system");
    } catch {}
  }, []);

  const pick = (value: string) => {
    setTheme(value);
    try {
      if (value === "system") localStorage.removeItem("pulse-theme");
      else localStorage.setItem("pulse-theme", value);
    } catch {}
    applyTheme(value);
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-border bg-background p-0.5">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          role="radio"
          aria-checked={theme === t.value}
          onClick={() => pick(t.value)}
          className={`h-8 rounded-md px-3 text-sm transition-colors ${
            theme === t.value ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
