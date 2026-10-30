import type { PrStatus, RepoActivity, WeekStats } from "./types";
import type { WeekWindow } from "./week";

const MAX_COMMITS_PER_REPO = 10;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function fmtRangeWithYear(week: WeekWindow) {
  const monthDay = (date: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00Z`));
  const sameMonth = week.startDate.slice(0, 7) === week.endDate.slice(0, 7);
  const end = sameMonth ? String(Number(week.endDate.slice(8))) : monthDay(week.endDate);
  return `${monthDay(week.startDate)} – ${end}, ${week.endDate.slice(0, 4)}`;
}

function fmtMerge(hours: number) {
  if (hours < 1) return "<1h";
  return hours < 48 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`;
}

const PR_GROUPS: { status: PrStatus; label: string }[] = [
  { status: "merged", label: "Merged" },
  { status: "open", label: "Open" },
  { status: "draft", label: "Draft" },
  { status: "closed", label: "Closed without merging" },
];

function repoSection(r: RepoActivity): string[] {
  const lines = [`## ${r.repo}`, ""];

  for (const { status, label } of PR_GROUPS) {
    const prs = r.prs.filter((pr) => pr.status === status);
    if (prs.length === 0) continue;
    lines.push(`**${label}**`);
    for (const pr of prs) {
      const merge = pr.hoursToMerge !== null ? ` _(${fmtMerge(pr.hoursToMerge)})_` : "";
      lines.push(`- [#${pr.number}](${pr.url}) ${pr.title}${merge}`);
    }
    lines.push("");
  }

  if (r.commits.length > 0) {
    lines.push(`**Commits** (${r.commits.length})`);
    for (const c of r.commits.slice(0, MAX_COMMITS_PER_REPO)) lines.push(`- \`${c.oid.slice(0, 7)}\` ${c.message}`);
    if (r.commits.length > MAX_COMMITS_PER_REPO) lines.push(`- …and ${r.commits.length - MAX_COMMITS_PER_REPO} more`);
    lines.push("");
  }

  if (r.reviews.length > 0) {
    lines.push("**Reviewed**");
    for (const rv of r.reviews) lines.push(`- [#${rv.prNumber}](${rv.prUrl}) ${rv.prTitle}`);
    lines.push("");
  }

  if (r.releases.length > 0) {
    lines.push("**Released**");
    for (const rel of r.releases) lines.push(`- [${rel.tagName}](${rel.url})${rel.name && rel.name !== rel.tagName ? ` ${rel.name}` : ""}`);
    lines.push("");
  }

  return lines;
}

/** Markdown for a week, ready to paste into Slack, email or Notion. */
export function toMarkdown(stats: WeekStats, week: WeekWindow, opts: { author?: string; narrative?: string | null } = {}) {
  const t = stats.totals;
  const headline = [
    plural(t.commits, "commit"),
    `${plural(t.prsMerged, "PR")} merged`,
    t.reviews && plural(t.reviews, "review"),
    t.issuesClosed && `${plural(t.issuesClosed, "issue")} closed`,
    t.releases && plural(t.releases, "release"),
    plural(t.activeRepos, "repo"),
  ].filter(Boolean);

  const lines = [`# Weekly update${opts.author ? ` — ${opts.author}` : ""} — ${fmtRangeWithYear(week)}`, ""];
  if (opts.narrative) lines.push(opts.narrative.trim(), "");
  lines.push(`**${headline.join(" · ")}**`, "");
  if (stats.repos.length === 0) lines.push("_No activity this week._", "");
  for (const r of stats.repos) lines.push(...repoSection(r));

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
