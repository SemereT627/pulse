import "server-only";
import type { Settings } from "@/db/schema";
import type { WeekStats } from "@/lib/report/types";
import { complete, modelFor, PROVIDERS } from "./providers";
import { periodSystemPrompt, periodUserPrompt, systemPrompt, userPrompt, type PeriodWeek } from "./summary";

/** Writes the week's narrative with the provider and options from settings. `model` is stored with the report. */
export async function generateNarrative(
  stats: WeekStats,
  previousNarrative: string | null,
  settings: Settings,
  apiKey: string | undefined,
) {
  return write(settings, apiKey, systemPrompt(settings), userPrompt(stats, settings.aiUsePrevious ? previousNarrative : null));
}

/** A month/quarter/year summary from that period's saved weekly reports. */
export async function generatePeriodNarrative(periodLabel: string, weeks: PeriodWeek[], settings: Settings, apiKey: string | undefined) {
  return write(settings, apiKey, periodSystemPrompt(settings, periodLabel), periodUserPrompt(weeks));
}

async function write(settings: Settings, apiKey: string | undefined, system: string, user: string) {
  const model = modelFor(settings);
  const text = (await complete(settings.aiProvider, apiKey, model, { system, user, maxTokens: 16000 })).trim();
  if (!text) throw new Error("The model returned an empty summary.");
  return { text, model: `${PROVIDERS[settings.aiProvider].label} · ${model}` };
}
