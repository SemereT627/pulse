import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Settings } from "@/db/schema";

export type ProviderId = Settings["aiProvider"];

type Provider = {
  label: string;
  /** Env vars holding the key, first one set wins. */
  env: string[];
  defaultModel: string;
  /** OpenAI-compatible chat completions base URL; absent = Anthropic's own API. */
  baseUrl?: string;
  /** Lists model ids, relative to baseUrl unless absolute. */
  modelsUrl?: string;
  headers?: Record<string, string>;
  hint: string;
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  anthropic: {
    label: "Anthropic",
    env: ["ANTHROPIC_API_KEY"],
    defaultModel: "claude-opus-5-5",
    hint: "ANTHROPIC_API_KEY from console.anthropic.com",
  },
  openai: {
    label: "OpenAI",
    env: ["OPENAI_API_KEY"],
    defaultModel: "gpt-5-mini",
    baseUrl: "https://api.openai.com/v1",
    modelsUrl: "/models",
    hint: "OPENAI_API_KEY from platform.openai.com",
  },
  gemini: {
    label: "Google Gemini",
    env: ["GEMINI_API_KEY"],
    defaultModel: "gemini-3.8-flash", // 2.5 is closed to new keys
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    modelsUrl: "/models",
    hint: "GEMINI_API_KEY from aistudio.google.com (free tier)",
  },
  github: {
    label: "GitHub Models",
    // A token with the Models permission; falls back to the data PAT, which may or may not have it.
    env: ["GITHUB_MODELS_TOKEN", "GITHUB_PAT"],
    defaultModel: "openai/gpt-4.1-mini",
    baseUrl: "https://models.github.ai/inference",
    modelsUrl: "https://models.github.ai/catalog/models",
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    hint: "GITHUB_MODELS_TOKEN (fine-grained, Models: read), or GITHUB_PAT if it has access",
  },
  // Default models below were current when added; the Test button in Settings lists what each key can use.
  groq: {
    label: "Groq",
    env: ["GROQ_API_KEY"],
    defaultModel: "openai/gpt-oss-120b",
    baseUrl: "https://api.groq.com/openai/v1",
    modelsUrl: "/models",
    hint: "GROQ_API_KEY from console.groq.com (free tier)",
  },
  openrouter: {
    label: "OpenRouter",
    env: ["OPENROUTER_API_KEY"],
    defaultModel: "openrouter/auto",
    baseUrl: "https://openrouter.ai/api/v1",
    modelsUrl: "/models",
    // Optional attribution headers OpenRouter asks apps to send.
    headers: { "HTTP-Referer": "https://pulse.semere.app", "X-Title": "Pulse" },
    hint: "OPENROUTER_API_KEY from openrouter.ai/keys (free models end in :free)",
  },
  mistral: {
    label: "Mistral",
    env: ["MISTRAL_API_KEY"],
    defaultModel: "mistral-medium-latest",
    baseUrl: "https://api.mistral.ai/v1",
    modelsUrl: "/models",
    hint: "MISTRAL_API_KEY from console.mistral.ai (free Experiment tier)",
  },
  cerebras: {
    label: "Cerebras",
    env: ["CEREBRAS_API_KEY"],
    defaultModel: "gpt-oss-120b",
    baseUrl: "https://api.cerebras.ai/v1",
    modelsUrl: "/models",
    hint: "CEREBRAS_API_KEY from cloud.cerebras.ai (free tier)",
  },
  deepseek: {
    label: "DeepSeek",
    env: ["DEEPSEEK_API_KEY"],
    defaultModel: "deepseek-flash",
    baseUrl: "https://api.deepseek.com/v1",
    modelsUrl: "/models",
    hint: "DEEPSEEK_API_KEY from platform.deepseek.com (paid, low cost)",
  },
};

export const isProviderId = (v: unknown): v is ProviderId => typeof v === "string" && v in PROVIDERS;

export function providerKey(id: ProviderId): { name: string; value: string } | null {
  for (const name of PROVIDERS[id].env) {
    const value = process.env[name];
    if (value) return { name, value };
  }
  return null;
}

export const modelFor = (settings: Pick<Settings, "aiProvider" | "aiModel">) =>
  settings.aiModel?.trim() || PROVIDERS[settings.aiProvider].defaultModel;

/** Whether summaries can actually be written: switched on and the chosen provider has a key. */
export const aiReady = (settings: Pick<Settings, "aiEnabled" | "aiProvider">) =>
  settings.aiEnabled && providerKey(settings.aiProvider) !== null;

export type Completion = { system: string; user: string; maxTokens: number };

export async function complete(id: ProviderId, model: string, req: Completion): Promise<string> {
  const key = providerKey(id);
  if (!key) throw new Error(`${PROVIDERS[id].label} has no API key (${PROVIDERS[id].hint}).`);
  if (id !== "anthropic") return completeOpenAiCompatible(id, key.value, model, req);
  try {
    return await completeAnthropic(key.value, model, req);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(OUT_OF_CREDIT.test(message) ? noCredit("Anthropic") : message);
  }
}

// Billing failures (OpenAI sends them as 429, DeepSeek as 402) won't clear up by retrying.
const OUT_OF_CREDIT = /insufficient_quota|credit_balance|credit balance|no credits|insufficient balance/i;
const noCredit = (label: string) => `Your ${label} account has no credit left. Add credit there, or switch provider in Settings.`;

async function completeAnthropic(apiKey: string, model: string, req: Completion) {
  const response = await new Anthropic({ apiKey }).beta.messages.create({
    model,
    max_tokens: req.maxTokens,
    output_config: { effort: "medium" },
    // On a safety decline, the API reruns the request on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: req.system,
    messages: [{ role: "user", content: req.user }],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined to write this summary.");
  if (response.stop_reason === "max_tokens") throw new Error("The summary was cut off; try again.");
  return response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
}

const RETRYABLE = new Set([429, 500, 502, 503]);
const RETRY_WAITS_MS = [2_000, 6_000];

async function completeOpenAiCompatible(id: ProviderId, apiKey: string, model: string, req: Completion) {
  const p = PROVIDERS[id];
  // No token cap: newer OpenAI models reject `max_tokens`, and the prompt already asks for a few paragraphs.
  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
  });
  const send = () =>
    fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...p.headers },
      body,
    });

  // Busy or rate-limited models (Gemini's newest often 503s) usually recover within seconds.
  let res = await send();
  for (const waitMs of RETRY_WAITS_MS) {
    if (!RETRYABLE.has(res.status)) break;
    if (res.status === 429 && OUT_OF_CREDIT.test(await res.clone().text())) break;
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, waitMs));
    res = await send();
  }
  if (!res.ok) throw new Error(await apiError(p.label, res, model));

  type Choice = { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string };
  const data = await readJson<{ choices?: Choice[] }>(p.label, res);
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new Error("The model declined to write this summary.");
  if (choice?.finish_reason === "length") throw new Error("The summary was cut off; try again.");
  return choice?.message?.content ?? "";
}

/** Model ids the key can use; doubles as a connection test. */
export async function listModels(id: ProviderId): Promise<string[]> {
  const key = providerKey(id);
  if (!key) throw new Error(`No key set. Add ${PROVIDERS[id].hint}.`);

  if (id === "anthropic") {
    const page = await new Anthropic({ apiKey: key.value }).models.list({ limit: 100 });
    return page.data.map((m) => m.id);
  }

  const p = PROVIDERS[id];
  const url = p.modelsUrl!.startsWith("http") ? p.modelsUrl! : `${p.baseUrl}${p.modelsUrl}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key.value}`, ...p.headers } });
  if (!res.ok) throw new Error(await apiError(p.label, res));
  const data = await readJson<{ data?: { id: string }[] } | { id: string }[]>(p.label, res);
  const rows = Array.isArray(data) ? data : (data.data ?? []);
  // Gemini prefixes ids with "models/"; chat completions take them bare.
  return rows.map((m) => m.id.replace(/^models\//, "")).sort();
}

/** A 200 that isn't JSON means something else answered (a VPN, DNS filter or captive portal), not the provider. */
async function readJson<T>(label: string, res: Response): Promise<T> {
  const body = await res.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(
      `${label} sent back "${body.slice(0, 40).trim()}" instead of JSON. Something on the network may be intercepting ${new URL(res.url).host}.`,
    );
  }
}

async function apiError(label: string, res: Response, model?: string) {
  const body = await res.text().catch(() => "");
  let detail = body.slice(0, 300);
  try {
    // Gemini wraps its error object in an array.
    const parsed = JSON.parse(body) as unknown;
    const json = (Array.isArray(parsed) ? parsed[0] : parsed) as { error?: { message?: string } | string; message?: string };
    detail = (typeof json.error === "string" ? json.error : json.error?.message) ?? json.message ?? detail;
  } catch {}
  if (res.status === 402 || OUT_OF_CREDIT.test(body)) return noCredit(label);
  if (res.status === 401 || res.status === 403) return `${label} rejected the key (${res.status}): ${detail}`;
  if (model && RETRYABLE.has(res.status))
    return `${label} is busy (${res.status}) and still was after retrying. Try again shortly, or pick another model than ${model} in Settings.`;
  return `${label} error ${res.status}: ${detail}`;
}
