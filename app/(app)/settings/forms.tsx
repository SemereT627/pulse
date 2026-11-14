"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { Settings } from "@/db/schema";
import { primaryButtonClass, buttonClass } from "@/components/ui";
import {
  deleteAccountAction,
  removeAiKeyAction,
  removePatAction,
  savePatAction,
  saveSettingsAction,
  testProviderAction,
  type SaveState,
} from "./actions";

const field =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-muted";

/** `savedKey` is masked ("•••• abcd"); the key itself never reaches the browser. */
type ProviderInfo = { id: Settings["aiProvider"]; label: string; defaultModel: string; hint: string; savedKey: string | null };

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
  const [removing, startRemove] = useTransition();

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
      <Field label="Provider" htmlFor="aiProvider">
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
                {p.savedKey ? "" : " (no key)"}
              </option>
            ))}
          </select>
          <button type="button" onClick={runTest} disabled={testing || !current.savedKey} className={`${buttonClass} shrink-0`}>
            {testing ? "Testing…" : "Test"}
          </button>
        </div>
        {(test.ok || test.error) && (
          <p className={`mt-1.5 text-xs ${test.error ? "text-danger" : "text-accent"}`}>{test.error ?? test.ok}</p>
        )}
      </Field>
      <Field
        label="API key"
        htmlFor="aiKey"
        hint={
          current.savedKey
            ? "Saved and encrypted. Paste a new one to replace it."
            : `Your own key; summaries are billed to your account. Get one at ${current.hint}.`
        }
      >
        <div className="flex gap-2">
          <input
            id="aiKey"
            name="aiKey"
            key={provider}
            type="password"
            autoComplete="off"
            placeholder={current.savedKey ?? "Paste your key"}
            className={`${field} font-mono text-xs`}
          />
          {current.savedKey && (
            <button
              type="button"
              disabled={removing}
              onClick={() => startRemove(() => removeAiKeyAction(provider))}
              className={`${buttonClass} shrink-0`}
            >
              Remove
            </button>
          )}
        </div>
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
          placeholder="Call the project by its product name. Mention blockers if a PR stayed open."
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
          placeholder="my-other-account"
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

export function ReportForm({ settings, defaultAuthor, cronTime }: { settings: Settings; defaultAuthor: string; cronTime: string }) {
  return (
    <SectionForm section="report">
      <Field label="Your name" htmlFor="reportAuthor" hint="Shown in the report's title.">
        <input
          id="reportAuthor"
          name="reportAuthor"
          defaultValue={settings.reportAuthor ?? ""}
          placeholder={defaultAuthor}
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

export function WeekForm({ settings, timezones }: { settings: Settings; timezones: string[] }) {
  return (
    <SectionForm section="week">
      <Field label="Week starts" htmlFor="weekStartDay" hint="Runs seven days from 00:00 on this day.">
        <select id="weekStartDay" name="weekStartDay" defaultValue={settings.weekStartDay} className={field}>
          {DAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Timezone" htmlFor="timezone" hint="Changing either one shifts week boundaries; saved reports keep their old weeks.">
        <input
          id="timezone"
          name="timezone"
          defaultValue={settings.timezone}
          list="timezones"
          autoComplete="off"
          className={`${field} font-mono text-xs`}
        />
        <datalist id="timezones">
          {timezones.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>
    </SectionForm>
  );
}

/** Optional PAT: used instead of the sign-in token, e.g. when an org hasn't approved Pulse. */
export function PatForm({ savedPat }: { savedPat: string | null }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(savePatAction, {});
  const [removing, startRemove] = useTransition();
  return (
    <form action={action}>
      <Field
        label="Personal access token"
        htmlFor="pat"
        hint={
          savedPat
            ? "In use instead of your sign-in. Remove it to go back."
            : "Optional. Classic token with repo and read:org, from the account you signed in with. Reaches org repos where the Pulse Weekly app isn't installed."
        }
      >
        <div className="flex gap-2">
          <input
            id="pat"
            name="pat"
            type="password"
            autoComplete="off"
            placeholder={savedPat ?? "ghp_…"}
            className={`${field} font-mono text-xs`}
          />
          <button type="submit" disabled={pending} className={`${primaryButtonClass} shrink-0`}>
            {pending ? "Checking…" : "Save"}
          </button>
          {savedPat && (
            <button
              type="button"
              disabled={removing}
              onClick={() => startRemove(() => removePatAction())}
              className={`${buttonClass} shrink-0`}
            >
              Remove
            </button>
          )}
        </div>
        {(state.error || state.ok) && (
          <p aria-live="polite" className={`mt-1.5 text-xs ${state.error ? "text-danger" : "text-accent"}`}>
            {state.error ?? "Saved"}
          </p>
        )}
      </Field>
    </form>
  );
}

export function DeleteAccount({ login }: { login: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonClass} text-danger`}>
        Delete my account
      </button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <p className="max-w-xs text-left text-xs text-muted">
        Deletes your settings, repos, reports, tokens and keys from Pulse. This can&apos;t be undone. Type{" "}
        <span className="font-mono text-foreground">{login}</span> to confirm.
      </p>
      <div className="flex gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-label="Your GitHub username"
          autoComplete="off"
          className={`${field} w-44 font-mono text-xs`}
        />
        <button
          type="button"
          disabled={pending || typed.trim().toLowerCase() !== login.toLowerCase()}
          onClick={() =>
            start(async () => {
              const result = await deleteAccountAction(typed);
              if (result?.error) setError(result.error);
            })
          }
          className={`${buttonClass} text-danger`}
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass}>
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
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
