import "server-only";
import type { Settings } from "@/db/schema";
import type { WeekStats } from "@/lib/report/types";
import { complete, modelFor, PROVIDERS } from "./providers";
import { systemPrompt, userPrompt } from "./summary";

/** Writes the week's narrative with the provider and options from settings. `model` is stored with the report. */
export async function generateNarrative(
  stats: WeekStats,
  previousNarrative: string | null,
  settings: Settings,
  apiKey: string | undefined,
) {
  const model = modelFor(settings);
  const text = (
    await complete(settings.aiProvider, apiKey, model, {
      system: systemPrompt(settings),
      user: userPrompt(stats, settings.aiUsePrevious ? previousNarrative : null),
      maxTokens: 16000,
    })
  ).trim();
  if (!text) throw new Error("The model returned an empty summary.");
  return { text, model: `${PROVIDERS[settings.aiProvider].label} · ${model}` };
}
