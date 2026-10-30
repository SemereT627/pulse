"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { settings, type Settings } from "@/db/schema";
import { isProviderId, listModels, type ProviderId } from "@/lib/ai/providers";
import { MD_SECTIONS } from "@/lib/report/markdown";
import { requireUser } from "@/lib/session";

const TOGGLES = ["aiEnabled", "cronEnabled"] as const;
export type SettingToggle = (typeof TOGGLES)[number];

export async function setToggleAction(key: SettingToggle, value: boolean) {
  await requireUser();
  if (!TOGGLES.includes(key)) throw new Error("Unknown setting");
  await db.update(settings).set({ [key]: value }).where(eq(settings.id, 1));
  refresh();
}

export type SaveState = { ok?: boolean; error?: string; at?: number };

const TONES: Settings["aiTone"][] = ["professional", "conversational", "concise"];
const LENGTHS: Settings["aiLength"][] = ["short", "medium", "long"];
// GitHub logins and branch names; anything else in a comma list is rejected rather than silently stored.
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const BRANCH = /^[\w./-]{1,100}$/;

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const list = (raw: string) => [...new Set(raw.split(",").map((v) => v.trim()).filter(Boolean))];
const oneOf = <T extends string>(value: string, options: readonly T[]): T | null =>
  (options as readonly string[]).includes(value) ? (value as T) : null;

/** Saves one settings section (`section` field) from a form. */
export async function saveSettingsAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requireUser();
  const section = text(form, "section");
  let values: Partial<Settings>;

  if (section === "ai") {
    const provider = text(form, "aiProvider");
    const tone = oneOf(text(form, "aiTone"), TONES);
    const length = oneOf(text(form, "aiLength"), LENGTHS);
    const instructions = text(form, "aiInstructions");
    if (!isProviderId(provider) || !tone || !length) return { error: "Pick a provider, tone and length." };
    if (instructions.length > 2000) return { error: "Keep instructions under 2,000 characters." };
    values = {
      aiProvider: provider,
      aiModel: text(form, "aiModel").slice(0, 200) || null,
      aiTone: tone,
      aiLength: length,
      aiInstructions: instructions || null,
      aiUsePrevious: form.get("aiUsePrevious") === "on",
    };
  } else if (section === "counts") {
    const logins = list(text(form, "extraAuthorLogins"));
    const branches = list(text(form, "defaultExtraBranches"));
    const badLogin = logins.find((l) => !LOGIN.test(l));
    if (badLogin) return { error: `"${badLogin}" isn't a GitHub username.` };
    const badBranch = branches.find((b) => !BRANCH.test(b));
    if (badBranch) return { error: `"${badBranch}" isn't a valid branch name.` };
    values = {
      excludePromotionPrs: form.get("excludePromotionPrs") === "on",
      extraAuthorLogins: logins.slice(0, 5),
      defaultExtraBranches: branches.slice(0, 10),
    };
  } else if (section === "report") {
    const day = Number(text(form, "reportDay"));
    if (!Number.isInteger(day) || day < 0 || day > 6) return { error: "Pick a report day." };
    values = {
      reportAuthor: text(form, "reportAuthor").slice(0, 100) || null,
      mdSections: MD_SECTIONS.filter((s) => form.getAll("mdSections").includes(s)),
      reportDay: day,
    };
  } else {
    return { error: "Unknown section." };
  }

  await db.update(settings).set(values).where(eq(settings.id, 1));
  refresh();
  return { ok: true, at: Date.now() };
}

/** Checks the provider's key by listing its models; the list feeds the model field's suggestions. */
export async function testProviderAction(provider: ProviderId): Promise<{ models?: string[]; error?: string }> {
  await requireUser();
  if (!isProviderId(provider)) return { error: "Unknown provider." };
  try {
    return { models: await listModels(provider) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Connection failed." };
  }
}
