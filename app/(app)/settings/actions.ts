"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { signOut } from "@/auth";
import { db } from "@/db";
import { aiKeys, settings, users, type Settings } from "@/db/schema";
import { getAiKeys, isProviderId, listModels, type ProviderId } from "@/lib/ai/providers";
import { encrypt } from "@/lib/crypto";
import { MD_SECTIONS } from "@/lib/report/markdown";
import { requireUser } from "@/lib/session";

const TOGGLES = ["aiEnabled", "cronEnabled"] as const;
export type SettingToggle = (typeof TOGGLES)[number];

export async function setToggleAction(key: SettingToggle, value: boolean) {
  const user = await requireUser();
  if (!TOGGLES.includes(key)) throw new Error("Unknown setting");
  await db.update(settings).set({ [key]: value }).where(eq(settings.userId, user.id));
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
  const user = await requireUser();
  const section = text(form, "section");
  let values: Partial<Settings>;

  if (section === "ai") {
    const provider = text(form, "aiProvider");
    const tone = oneOf(text(form, "aiTone"), TONES);
    const length = oneOf(text(form, "aiLength"), LENGTHS);
    const instructions = text(form, "aiInstructions");
    if (!isProviderId(provider) || !tone || !length) return { error: "Pick a provider, tone and length." };
    if (instructions.length > 2000) return { error: "Keep instructions under 2,000 characters." };
    // Write-only: an empty field keeps the saved key.
    const key = text(form, "aiKey");
    if (key.length > 500) return { error: "That API key is too long." };
    if (key) {
      const values = { key: encrypt(key), updatedAt: new Date() };
      await db
        .insert(aiKeys)
        .values({ userId: user.id, provider, ...values })
        .onConflictDoUpdate({ target: [aiKeys.userId, aiKeys.provider], set: values });
    }
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
  } else if (section === "week") {
    const timezone = text(form, "timezone");
    const day = Number(text(form, "weekStartDay"));
    if (!Intl.supportedValuesOf("timeZone").includes(timezone) && timezone !== "UTC") return { error: `"${timezone}" isn't a timezone.` };
    if (!Number.isInteger(day) || day < 0 || day > 6) return { error: "Pick a start day." };
    values = { timezone, weekStartDay: day };
  } else {
    return { error: "Unknown section." };
  }

  await db.update(settings).set(values).where(eq(settings.userId, user.id));
  refresh();
  return { ok: true, at: Date.now() };
}

/** Checks the provider's key by listing its models; the list feeds the model field's suggestions. */
export async function testProviderAction(provider: ProviderId): Promise<{ models?: string[]; error?: string }> {
  const user = await requireUser();
  if (!isProviderId(provider)) return { error: "Unknown provider." };
  const key = (await getAiKeys(user.id))[provider];
  try {
    return { models: await listModels(provider, key) };
  } catch (e) {
    // Provider errors go to the browser; make sure none of them echoes the key back.
    const message = e instanceof Error ? e.message : "Connection failed.";
    return { error: key ? message.replaceAll(key, "••••") : message };
  }
}

export async function removeAiKeyAction(provider: ProviderId) {
  const user = await requireUser();
  if (!isProviderId(provider)) return;
  await db.delete(aiKeys).where(and(eq(aiKeys.userId, user.id), eq(aiKeys.provider, provider)));
  refresh();
}

/** Saves a personal access token after checking it belongs to the signed-in GitHub account. */
export async function savePatAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const user = await requireUser();
  const token = text(form, "pat");
  if (!token) return { error: "Paste a token first." };
  if (token.length > 500) return { error: "That doesn't look like a GitHub token." };

  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  }).catch(() => null);
  if (!res) return { error: "Couldn't reach GitHub. Try again." };
  if (res.status === 401) return { error: "GitHub doesn't accept that token." };
  if (!res.ok) return { error: `GitHub answered ${res.status}. Try again.` };
  const owner = (await res.json()) as { id: number; login: string };
  if (owner.id !== user.githubId) {
    return { error: `This token belongs to @${owner.login}, but you're signed in as @${user.login}.` };
  }
  const scopes = res.headers.get("x-oauth-scopes");
  // Fine-grained tokens send no scope header; classic ones should carry repo.
  if (scopes !== null && !scopes.split(",").map((s) => s.trim()).includes("repo")) {
    return { error: "This token is missing the repo scope, so it can't read private repos." };
  }

  await db.update(users).set({ pat: encrypt(token), tokenInvalid: false }).where(eq(users.id, user.id));
  refresh();
  return { ok: true, at: Date.now() };
}

export async function removePatAction() {
  const user = await requireUser();
  await db.update(users).set({ pat: null, tokenInvalid: false }).where(eq(users.id, user.id));
  refresh();
}

/** Deletes the user and, by cascade, all their settings, repos, snapshots, reports and keys. */
export async function deleteAccountAction(confirmLogin: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (confirmLogin.trim().toLowerCase() !== user.login.toLowerCase()) return { error: "Type your GitHub username to confirm." };
  await db.delete(users).where(eq(users.id, user.id));
  await signOut({ redirectTo: "/signin" });
  return {};
}
