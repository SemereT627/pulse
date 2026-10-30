import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { WeekStats } from "@/lib/report/types";

export const SUMMARY_MODEL = "claude-opus-5-5";

const MAX_COMMITS_PER_REPO = 40;

export function aiEnabled() {
  return process.env.AI_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM = `You write the weekly work-update email body for a software engineer, from their GitHub activity.

Write in first person, professional but natural, like a status update to a manager. Group related work into 2-4 flowing paragraphs by theme or project, not per-item bullet points. Treat pull request titles and descriptions as the source of truth for what each change was about; use commit messages only to fill in detail. Describe outcomes in plain language rather than listing PR numbers or commit hashes. If last week's update is provided, avoid repeating it and say "continued" where work carries over.

Output only the paragraphs of body text: no greeting, no sign-off, no subject line, no headings.`;

/** Activity as plain text for the prompt, adapted from weekly-report.py's build_email_prompt. */
export function activityPrompt(stats: WeekStats): string {
  return stats.repos
    .map((r) => {
      const parts = [`Repo '${r.repo}':`];
      for (const pr of r.prs) {
        let line = `- PR #${pr.number} (${pr.status}): ${pr.title}`;
        if (pr.body) line += `\n  ${pr.body.slice(0, 400).replace(/\s+/g, " ")}`;
        parts.push(line);
      }
      if (r.commits.length) {
        parts.push("Commits:");
        parts.push(...r.commits.slice(0, MAX_COMMITS_PER_REPO).map((c) => `- ${c.message}`));
        if (r.commits.length > MAX_COMMITS_PER_REPO) parts.push(`- (and ${r.commits.length - MAX_COMMITS_PER_REPO} more)`);
      }
      if (r.reviews.length) {
        parts.push("Reviewed:");
        parts.push(...r.reviews.map((rv) => `- PR #${rv.prNumber}: ${rv.prTitle}`));
      }
      if (r.releases.length) parts.push(`Released: ${r.releases.map((rel) => rel.tagName).join(", ")}`);
      return parts.join("\n");
    })
    .join("\n\n");
}

export async function generateNarrative(stats: WeekStats, previousNarrative: string | null): Promise<string> {
  const client = new Anthropic();
  const previous = previousNarrative ? `Last week's update, for context:\n\n${previousNarrative}\n\n---\n\n` : "";

  const response = await client.beta.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    // On a safety decline, the API reruns the request on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${previous}Here is my GitHub activity (pull requests and commits) for the week:\n\n${activityPrompt(stats)}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("The model declined to write this summary.");
  if (response.stop_reason === "max_tokens") throw new Error("The summary was cut off; try again.");

  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
  if (!text) throw new Error("The model returned an empty summary.");
  return text;
}
