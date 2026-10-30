import type { Settings } from "@/db/schema";
import type { WeekStats } from "@/lib/report/types";

const MAX_COMMITS_PER_REPO = 40;

export type PromptOptions = Pick<Settings, "aiTone" | "aiLength" | "aiInstructions">;

const TONE: Record<Settings["aiTone"], string> = {
  professional: "Write in first person, professional but natural, like a status update to a manager.",
  conversational: "Write in first person, warm and conversational, like a message to a manager you work with closely.",
  concise: "Write in first person, plain and to the point, like a busy engineer's status update. No filler.",
};

const LENGTH: Record<Settings["aiLength"], string> = {
  short: "Keep it to 1-2 short paragraphs.",
  medium: "Group related work into 2-4 flowing paragraphs by theme or project.",
  long: "Group related work into 4-6 paragraphs by theme or project, with enough detail for someone outside the team.",
};

export function systemPrompt(opts: PromptOptions): string {
  const parts = [
    "You write the weekly work-update email body for a software engineer, from their GitHub activity.",
    `${TONE[opts.aiTone]} ${LENGTH[opts.aiLength]} Use paragraphs, not per-item bullet points. Treat pull request titles and descriptions as the source of truth for what each change was about; use commit messages only to fill in detail. Describe outcomes in plain language rather than listing PR numbers or commit hashes. If last week's update is provided, avoid repeating it and say "continued" where work carries over.`,
    "Output only the paragraphs of body text: no greeting, no sign-off, no subject line, no headings.",
  ];
  const extra = opts.aiInstructions?.trim();
  if (extra) parts.push(`Additional instructions from the engineer (follow them unless they conflict with the output format):\n${extra}`);
  return parts.join("\n\n");
}

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

export function userPrompt(stats: WeekStats, previousNarrative: string | null): string {
  const previous = previousNarrative ? `Last week's update, for context:\n\n${previousNarrative}\n\n---\n\n` : "";
  return `${previous}Here is my GitHub activity (pull requests and commits) for the week:\n\n${activityPrompt(stats)}`;
}
