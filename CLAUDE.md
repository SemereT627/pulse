@AGENTS.md

# Pulse

Personal weekly GitHub report for Semere (GitHub login `semere-wazza`), deployed on Vercel at pulse.semere.app. It reports only on Semere's own activity (not team stats), and its main output is a first-person weekly update for their manager. It replaces the CLI script in `~/Documents/dev/work/omnifleet/weekly-report/weekly-report.py`.

## Decisions (agreed, don't relitigate)

- Single user. GitHub OAuth is only a sign-in gate (`ALLOWED_USERS`); all GitHub data comes from one classic PAT (`GITHUB_PAT`, scopes `repo`, `read:org`, `read:user`), in the UI and in cron. No OAuth token is stored.
- Week = Fri 00:00 → Thu 23:59 in `Africa/Addis_Ababa` (settings row: `timezone`, `weekStartDay` = 5). Cron runs Friday 12:00 UTC (15:00 Addis) and reports the week that just ended.
- Commits count on the default branch plus per-repo extra branches (default `dev`), deduped by sha; merge commits are dropped. OmniFleet work lands on `dev`, so this matters.
- PRs are searched by `updated:` (not `created:`) so PRs opened earlier but merged this week count.
- AI narrative: `@anthropic-ai/sdk`, model `claude-opus-5-5`, effort `medium`, `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). Gated by `AI_ENABLED=true` + `ANTHROPIC_API_KEY` + `settings.aiEnabled`.
- Neon Postgres in Frankfurt (pooled URL); Vercel functions pinned to `fra1` in `vercel.json`.

## Stack and layout

Next.js 16 (App Router, **Cache Components on**, `proxy.ts` instead of middleware), Tailwind v4, Framer Motion, Auth.js v5 beta, Drizzle + `@neondatabase/serverless`, `@octokit/graphql`, Vitest. pnpm.

- `auth.ts`, `proxy.ts`: sign-in gate; everything except `/api/auth`, `/api/cron`, `/signin` requires a session. Server actions re-check with `requireUser()` (`lib/session.ts`).
- `db/schema.ts`: `settings` and `rate_limit` (single row, id 1), `sources` (repos + `included` + `extraBranches`), `snapshots` (raw GitHub data per week; key `repo:<id>` or `user`), `reports` (one row per week: stats, markdown, narrative).
- `lib/github/`: `client.ts` (`gh()` wrapper records rate limit after each call), `repos.ts` (repo discovery/sync), `activity.ts` (batched commit/release queries, PR/issue search, reviews via contributionsCollection).
- `lib/report/`: pure `week.ts`, `aggregate.ts`, `markdown.ts` (unit-tested); `load.ts` (snapshot cache: in-progress week refetches after 15 min, branch-config change refetches that repo); `generate.ts` (writes `reports` rows).
- `lib/report/collaborators.ts`: pure; people from my PRs' reviewers + authors of PRs I reviewed (Contributors page). `UserSnapshot.v` (`USER_SNAPSHOT_VERSION`) forces a refetch of cached user snapshots when fields are added.
- `lib/report/selected.ts`: `selectedWeek(searchParams)` resolves `?week=YYYY-MM-DD` (snapped, future → current); every week-scoped page uses it.
- `lib/ai/summary.ts`: narrative prompt + call.
- UI: dashboard shell in `app/(app)/layout.tsx` + `components/shell/` (sidebar, top bar with week picker and user menu, mobile drawer). Sections: `/` Overview, `/reports` (report + archive), `/repositories` (activity) and `/repositories/manage` (tracked repos), `/contributors`, `/settings` (cron/AI toggles, connection status). Selected week lives in `?week=`; sidebar links carry it. Old `/week/:week` and `/sources` redirect in `next.config.ts`.
- Brand (from the logo canvas https://claude.ai/artifact/Xvn25eiwCSsVJHjH9P9XSR): 7-bar mark (`components/logo.tsx`), 3-bar favicon (`app/icon.svg`), ink `#0E100F` + lime `#C6F36B` (light: `#F6F7F3` + `#3B7D10`), Space Grotesk display, JetBrains Mono data.
- `app/api/cron/weekly/route.ts`: `Authorization: Bearer $CRON_SECRET`; `?week=YYYY-MM-DD` regenerates a given week.

## Conventions and gotchas

- With Cache Components, anything reading the session, `params`, `searchParams`, or the DB must sit inside `<Suspense>`; otherwise the build fails.
- Read `node_modules/next/dist/docs/` before using Next APIs; this Next version differs from older training data.
- `auth()` uses crypto, so call `await connection()` before it in server components, or prerendering errors.
- Lint flags `Date.now()` during render; read `new Date()` once instead.
- `.env.local` holds secrets and contains an unquoted URL with `&`, so don't `source` it in a shell; load it with dotenv.
- `.smoke/` (gitignored, lint-ignored) holds local smoke scripts: `vitest run -c .smoke/vitest.config.mts` runs fetchers against real GitHub/Neon with `server-only` stubbed.
- Pushing: SSH logs in as `SemereT627`, but this repo is under `semere-wazza`, so `origin` is HTTPS with a repo-local credential helper using `gh auth token --user semere-wazza`. Don't change it.
- Commit and push to `main` after a change is verified, with the Claude co-author line.

## Commands

`pnpm dev` · `pnpm test` · `pnpm lint` · `pnpm build` · `pnpm db:generate` / `pnpm db:migrate` (reads `.env.local`)

## Status (2026-10-30)

Done and pushed: sign-in, sources page, fetching + cache, aggregation, multi-section dashboard (sidebar, Overview/Reports/Repositories/Contributors/Settings), Markdown export, cron, AI summary. 20 tests.

Next:
- AI summary not yet run live: needs `AI_ENABLED=true` and `ANTHROPIC_API_KEY` in `.env.local`, then `pnpm vitest run -c .smoke/vitest.config.mts .smoke/ai.test.ts`.
- Deploy to Vercel (import repo, copy env vars, add domain `pulse.semere.app` with CNAME `pulse` → `cname.vercel-dns.com`, check the cron is listed).
- `GITHUB_PAT` expires 2026-11-29; regenerate with a longer expiry (also in Vercel).
- Not built: emailing the report (Resend). Commits authored as `SemereT627` aren't counted.
- Dev→main promotion PRs (titled "Dev") inflate "PRs merged"; consider grouping or excluding them.
